// One-time: drop indexes no query uses (every query on these collections was checked;
// each one below is either a duplicate prefix of another index or serves no query).
//
// RUN ONLY AFTER DEPLOYING the matching src/lib/models.ts change. The old code
// declares these indexes, and Mongoose would rebuild them when it restarts.
//
// Preview:  node scripts/db-maintenance/drop-unused-indexes.cjs
// Apply:    node scripts/db-maintenance/drop-unused-indexes.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const UNUSED = [
  ['listingsnapshots', 'listingId_1'],                  // prefix of listingId_1_day_1
  ['listingsnapshots', 'shopId_1'],                     // no query filters snapshots by shop
  ['listingsnapshots', 'listingId_1_capturedAt_-1'],    // queries sort by day, not capturedAt
  ['trackedlistings', 'shopId_1_lastSeenAt_-1'],        // no query filters tracked listings by shop
  ['trackedlistings', 'observeCount_-1'],               // nothing sorts by observeCount
  ['searchranksnapshots', 'listingId_1_day_-1'],        // rank queries always include the keyword
  ['shopsnapshots', 'shopId_1'],                        // prefix of shopId_1_day_1
  ['shopsnapshots', 'shopId_1_capturedAt_-1'],          // queries sort by day
]
const mb = n => (n / 1048576).toFixed(1) + ' MB'

;(async () => {
  const c = new MongoClient(process.env.MONGODB_URI)
  await c.connect()
  const db = c.db()
  let total = 0
  console.log(APPLY ? 'APPLYING' : 'PREVIEW (add --apply to drop)')
  for (const [coll, name] of UNUSED) {
    const col = db.collection(coll)
    const [st] = await col.aggregate([{ $collStats: { storageStats: {} } }]).toArray()
    const size = st.storageStats.indexSizes[name]
    if (size == null) { console.log(`  ${coll}.${name}: not present, skipping`); continue }
    total += size
    if (APPLY) await col.dropIndex(name)
    console.log(`  ${APPLY ? 'dropped' : 'would drop'} ${coll}.${name} (${mb(size)})`)
  }
  console.log(`${APPLY ? 'Freed' : 'Would free'} about ${mb(total)} of index space.`)
  await c.close()
})().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
