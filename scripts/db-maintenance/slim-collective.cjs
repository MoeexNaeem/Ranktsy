// One-time: slim saved shared keyword packages (collectivekeyworddatas).
// Drops each listing's `description` and every image after the first. Nothing reads
// those fields from these packages (checked in Rankkw and Ranktsy): the keyword pages
// render images[0] only, and the AI / compare / audit tools fetch listings fresh.
//
// Safe to run any time. Preview:  node scripts/db-maintenance/slim-collective.cjs
//                        Apply:    node scripts/db-maintenance/slim-collective.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const mb = n => (n / 1048576).toFixed(1) + ' MB'

;(async () => {
  const c = new MongoClient(process.env.MONGODB_URI, { socketTimeoutMS: 0 })
  await c.connect()
  const col = c.db().collection('collectivekeyworddatas')
  const stat = async () => (await col.aggregate([{ $collStats: { storageStats: {} } }]).toArray())[0].storageStats
  const before = await stat()
  console.log(`${APPLY ? 'APPLYING' : 'PREVIEW (add --apply to change data)'}: ${before.count} docs, data ${mb(before.size)}`)

  let checked = 0, slimmed = 0, savedBytes = 0
  for await (const d of col.find({}, { projection: { 'data.listings': 1 } })) {
    checked++
    const ls = d.data && d.data.listings
    if (!Array.isArray(ls) || !ls.some(l => l.description || (l.images && l.images.length > 1))) continue
    const slim = ls.map(l => ({ ...l, description: '', images: Array.isArray(l.images) ? l.images.slice(0, 1) : [] }))
    savedBytes += JSON.stringify(ls).length - JSON.stringify(slim).length
    slimmed++
    if (APPLY) await col.updateOne({ _id: d._id }, { $set: { 'data.listings': slim } })
    if (checked % 250 === 0) console.log(`  ${checked}/${before.count} checked`)
  }
  console.log(`${APPLY ? 'Slimmed' : 'Would slim'} ${slimmed} of ${checked} docs, about ${mb(savedBytes)} less data.`)
  if (APPLY) console.log(`data size now ${mb((await stat()).size)} (was ${mb(before.size)})`)
  await c.close()
})().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
