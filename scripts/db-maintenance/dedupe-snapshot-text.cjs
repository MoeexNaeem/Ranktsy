// Shrinks listingsnapshots WITHOUT changing any result (2026-10-03).
//
//   A. Title/tags: older daily rows copy the full title and 13 tags every day even
//      when nothing changed (newer rows already store them only on change days).
//      A row's title is removed only when it is IDENTICAL to the listing's
//      previous stored title (tags: same set of tags). The first row and every
//      day a change happened keep their text, and getListingChanges() carries
//      the last stored value forward, so the change log reads exactly the same.
//      A full copy is also kept every KEEP_EVERY_DAYS, so when old rows expire
//      (150-day retention) the 90-day change log still finds the earlier text.
//   B. Empty placeholders: reviewCount / priceOriginal / onSale / rating /
//      quantity / bestRank stored as null are removed. Absent already reads as
//      null everywhere (Mongo's `null` query matches absent too). Real values,
//      including 0 and false, are never touched.
//
// Views, favorites, reviews, price and currency are never modified.
//
// Works one batch of listings at a time with pauses, and backs off when the
// database is slow, so the site stays usable. Run it at a quiet time.
// Resumable: progress is saved after every batch; re-running continues.
//
// Preview:  node scripts/db-maintenance/dedupe-snapshot-text.cjs
//           (scans a sample, estimates the saving, changes nothing)
// Apply:    node scripts/db-maintenance/dedupe-snapshot-text.cjs --apply
// Restart from the beginning:  add --reset
require('@next/env').loadEnvConfig(process.cwd(), true)
const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const RESET = process.argv.includes('--reset')
const CHUNK = 4000              // rows read per batch
const PAUSE_MS = 250            // rest between batches
const SLOW_PING_MS = 1500       // back off while the DB is slower than this
const PREVIEW_SPOTS = 20        // preview samples this many places across the collection
const PREVIEW_ROWS_PER_SPOT = 8000
const KEEP_EVERY_DAYS = 30      // keep one full copy at least this often
const PROGRESS = path.join(__dirname, '.dedupe-snapshot-progress.json')
const NULL_FIELDS = ['reviewCount', 'priceOriginal', 'onSale', 'rating', 'quantity', 'bestRank']

const sleep = ms => new Promise(r => setTimeout(r, ms))
const tagsKey = t => (Array.isArray(t) && t.length ? [...t].sort().join('\u0001') : '')
const bytes = s => Buffer.byteLength(s || '', 'utf8')
const gap = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000

;(async () => {
  const c = new MongoClient(process.env.MONGODB_URI)
  await c.connect()
  const db = c.db()
  const col = db.collection('listingsnapshots')
  const admin = c.db('admin')

  let state = { lastId: -1, rows: 0, titles: 0, tags: 0, nulls: 0, bytes: 0, updated: 0 }
  if (APPLY && !RESET && fs.existsSync(PROGRESS)) {
    state = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'))
    console.log(`Resuming after listing ${state.lastId} (${state.rows.toLocaleString()} rows done).`)
  }
  const total = await col.estimatedDocumentCount()
  console.log(APPLY ? 'APPLYING' : 'PREVIEW (nothing is changed; add --apply to save)', `- about ${total.toLocaleString()} rows`)

  // Preview samples evenly spaced points across all listings (not just the
  // oldest ones) so the estimate is representative. Apply walks everything.
  let spots = [state.lastId]
  if (!APPLY) {
    const lo = (await col.find({}, { projection: { listingId: 1 } }).sort({ listingId: 1 }).hint({ listingId: 1, day: 1 }).limit(1).next()).listingId
    const hi = (await col.find({}, { projection: { listingId: 1 } }).sort({ listingId: -1 }).hint({ listingId: 1, day: 1 }).limit(1).next()).listingId
    spots = Array.from({ length: PREVIEW_SPOTS }, (_, i) => Math.floor(lo + (hi - lo) * i / PREVIEW_SPOTS) - 1)
  }

  const started = Date.now()
  for (const spot of spots) {
  state.lastId = spot
  let spotRows = 0
  for (;;) {
    // Gentle on a busy database: wait while it is slow.
    for (let t0 = Date.now(); ; ) {
      const p0 = Date.now(); await admin.command({ ping: 1 }); const ping = Date.now() - p0
      if (ping < SLOW_PING_MS) break
      if (Date.now() - t0 > 2000) process.stdout.write(`  database busy (${ping} ms), waiting...\r`)
      await sleep(10000)
    }

    const rows = await col.find(
      { listingId: { $gt: state.lastId } },
      { projection: { listingId: 1, day: 1, title: 1, tags: 1, ...Object.fromEntries(NULL_FIELDS.map(f => [f, 1])) } },
    ).sort({ listingId: 1, day: 1 }).hint({ listingId: 1, day: 1 }).limit(CHUNK).toArray()
    if (!rows.length) break

    // Only whole listings per batch, so "previous title" is always known. (If a
    // single listing has more rows than CHUNK, take them all in this batch.)
    let batch = rows
    const lastListing = rows[rows.length - 1].listingId
    if (rows.length === CHUNK) {
      batch = rows.filter(r => r.listingId !== lastListing)
      if (!batch.length) {
        batch = await col.find({ listingId: lastListing }, { projection: { listingId: 1, day: 1, title: 1, tags: 1, ...Object.fromEntries(NULL_FIELDS.map(f => [f, 1])) } })
          .sort({ day: 1 }).hint({ listingId: 1, day: 1 }).toArray()
      }
    }

    const ops = []
    let prevId = null, prevTitle, prevTitleDay, prevTags, prevTagsDay
    for (const r of batch) {
      if (r.listingId !== prevId) { prevId = r.listingId; prevTitle = prevTags = prevTitleDay = prevTagsDay = undefined }
      const unset = {}
      if (typeof r.title === 'string' && r.title !== '') {
        if (r.title === prevTitle && gap(prevTitleDay, r.day) < KEEP_EVERY_DAYS) { unset.title = ''; state.titles++; state.bytes += bytes(r.title) + 8 }
        else { prevTitle = r.title; prevTitleDay = r.day }
      }
      if (Array.isArray(r.tags) && r.tags.length) {
        const k = tagsKey(r.tags)
        if (k === prevTags && gap(prevTagsDay, r.day) < KEEP_EVERY_DAYS) { unset.tags = ''; state.tags++; state.bytes += bytes(r.tags.join('')) + 8 * r.tags.length + 8 }
        else { prevTags = k; prevTagsDay = r.day }
      }
      for (const f of NULL_FIELDS) if (f in r && r[f] === null) { unset[f] = ''; state.nulls++; state.bytes += f.length + 2 }
      if (Object.keys(unset).length) ops.push({ updateOne: { filter: { _id: r._id }, update: { $unset: unset } } })
    }

    if (APPLY && ops.length) {
      for (let i = 0; i < ops.length; i += 500) await col.bulkWrite(ops.slice(i, i + 500), { ordered: false })
      state.updated += ops.length
    } else if (!APPLY) state.updated += ops.length

    state.rows += batch.length
    spotRows += batch.length
    state.lastId = batch[batch.length - 1].listingId
    if (APPLY) fs.writeFileSync(PROGRESS, JSON.stringify(state))

    const mins = ((Date.now() - started) / 60000).toFixed(1)
    process.stdout.write(`  ${state.rows.toLocaleString()} rows checked, ${state.updated.toLocaleString()} ${APPLY ? 'cleaned' : 'would be cleaned'}, ~${(state.bytes / 1048576).toFixed(0)} MB saved (${mins} min)          \r`)
    if (!APPLY && spotRows >= PREVIEW_ROWS_PER_SPOT) break
    await sleep(PAUSE_MS)
  }
  }

  console.log('\n')
  const scale = !APPLY && state.rows ? total / state.rows : 1
  const est = n => Math.round(n * scale).toLocaleString()
  console.log(`${APPLY ? 'Done' : 'Estimate for the whole collection'}:`)
  console.log(`  repeated titles removed:     ${est(state.titles)}`)
  console.log(`  repeated tag lists removed:  ${est(state.tags)}`)
  console.log(`  empty placeholders removed:  ${est(state.nulls)}`)
  console.log(`  rows changed:                ${est(state.updated)}`)
  console.log(`  space saved (uncompressed):  about ${(state.bytes * scale / 1048576).toFixed(0)} MB`)
  if (APPLY) { fs.rmSync(PROGRESS, { force: true }); console.log('\nFinished. Progress file removed.') }
  await c.close()
})().catch(e => { console.error('\nStopped:', e.message, '\nRe-run the same command to continue where it left off.'); process.exit(1) })
