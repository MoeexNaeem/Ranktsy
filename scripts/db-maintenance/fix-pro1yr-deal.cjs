// One-time: bring the live "Pro · 1-Year" deal in line with the pricing cards.
//   - "200 keyword searches / day" -> "Up to 100 keyword searches / day"
//     (1,000 credits a day at 10 credits per search = 100 searches)
//   - summary "bonus pack of 100" -> "bonus pack of 25" (the page body already says 25)
//   - em dashes -> " - " (house style)
// Only the deal with seedKey 'pro-1yr-deal' is touched. Safe to re-run.
//
// Preview:  node scripts/db-maintenance/fix-pro1yr-deal.cjs
// Apply:    node scripts/db-maintenance/fix-pro1yr-deal.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const fix = s => (s || '')
  .replace('**200 keyword searches / day**', '**Up to 100 keyword searches / day**')
  .replace('bonus pack of 100 ready-to-list', 'bonus pack of 25 ready-to-list')
  .replace(/\s*—\s*/g, ' - ')

;(async () => {
  const c = new MongoClient(process.env.MONGODB_URI)
  await c.connect()
  const col = c.db().collection('deals')
  const d = await col.findOne({ seedKey: 'pro-1yr-deal' })
  if (!d) { console.log('Deal not found, nothing to do.'); return c.close() }

  const next = { title: fix(d.title), summary: fix(d.summary), content: fix(d.content) }
  const changed = Object.keys(next).filter(k => next[k] !== (d[k] || ''))
  if (!changed.length) { console.log('Already correct, nothing to do.'); return c.close() }

  console.log(`${APPLY ? 'APPLYING' : 'PREVIEW (add --apply to save)'}: fields changing: ${changed.join(', ')}`)
  for (const k of changed) console.log(`\n--- ${k} ---\n${next[k]}`)
  if (APPLY) {
    const r = await col.updateOne({ _id: d._id }, { $set: { ...next, updatedAt: new Date() } })
    console.log(`\nSaved (${r.modifiedCount} deal updated).`)
  }
  await c.close()
})().catch(e => { console.error(e); process.exit(1) })
