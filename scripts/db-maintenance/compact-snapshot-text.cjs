// One-time: remove repeated title/tags from past daily listing snapshots.
// Walks each listing's snapshots oldest -> newest and keeps title/tags only on the
// days they differ from the previous stored value (blank values from thin
// observations are removed too). Views, favorites, reviews and price are untouched.
// getListingChanges() carries the last stored value forward, so the change log
// reads exactly the same (verified on real listings before this was written).
//
// RUN ONLY AFTER DEPLOYING the matching src/lib/snapshots.ts change. The old change
// log compares raw rows and would misread days where the text was removed.
// Today's rows are never modified. Safe to re-run; already-compacted rows are skipped.
//
// Preview:  node scripts/db-maintenance/compact-snapshot-text.cjs
// Apply:    node scripts/db-maintenance/compact-snapshot-text.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const today = new Date().toISOString().slice(0, 10)
const tagsKey = t => (Array.isArray(t) && t.length ? [...t].sort().join('\u0001') : '')
const mb = n => (n / 1048576).toFixed(1) + ' MB'

;(async () => {
  const c = new MongoClient(process.env.MONGODB_URI, { socketTimeoutMS: 0 })
  await c.connect()
  const col = c.db().collection('listingsnapshots')
  const stat = async () => (await col.aggregate([{ $collStats: { storageStats: {} } }]).toArray())[0].storageStats
  const before = await stat()
  console.log(`${APPLY ? 'APPLYING' : 'PREVIEW (add --apply to change data)'}: ${before.count.toLocaleString()} snapshots, data ${mb(before.size)}`)

  let rows = 0, unsetTitle = 0, unsetTags = 0, textBytes = 0
  let curId = null, lastT, lastG
  let ops = []
  const flush = async () => {
    if (APPLY && ops.length) await col.bulkWrite(ops, { ordered: false })
    ops = []
  }

  const cursor = col.find({}, { projection: { listingId: 1, day: 1, title: 1, tags: 1 } })
    .sort({ listingId: 1, day: 1 }).hint({ listingId: 1, day: 1 }).batchSize(5000)
  for await (const r of cursor) {
    rows++
    if (r.listingId !== curId) { curId = r.listingId; lastT = undefined; lastG = undefined }
    const unset = {}
    if (r.title !== undefined) {
      if (!r.title || r.title === lastT) { unset.title = ''; textBytes += (r.title || '').length }
      else lastT = r.title
    }
    if (r.tags !== undefined) {
      const k = tagsKey(r.tags)
      if (!k || k === lastG) { unset.tags = ''; textBytes += (r.tags || []).join('').length }
      else lastG = k
    }
    // Today's rows are still being written; leave them (they still advance lastT/lastG).
    if (r.day < today && Object.keys(unset).length) {
      if (unset.title !== undefined) unsetTitle++
      if (unset.tags !== undefined) unsetTags++
      ops.push({ updateOne: { filter: { _id: r._id }, update: { $unset: unset } } })
      if (ops.length >= 1000) await flush()
    }
    if (rows % 250000 === 0) console.log(`  ${rows.toLocaleString()} / ${before.count.toLocaleString()} rows`)
  }
  await flush()
  console.log(`${APPLY ? 'Removed' : 'Would remove'} repeated title on ${unsetTitle.toLocaleString()} rows and tags on ${unsetTags.toLocaleString()} rows (~${mb(textBytes)} of text).`)
  if (APPLY) console.log(`data size now ${mb((await stat()).size)} (was ${mb(before.size)})`)
  await c.close()
})().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
