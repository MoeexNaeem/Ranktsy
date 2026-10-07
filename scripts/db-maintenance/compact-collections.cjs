// One-time: give empty space inside 3 collections back to the disk (MongoDB `compact`).
// Changes NO data: it only rewrites each collection's file without the gaps left by
// deleted/shrunk documents. Run it about a day AFTER deploying the keyword-cache
// compression (2026-10-08), so the cache has turned over to the small format first.
//
// Every member of the replica set holds its own copy, so it runs on each one:
// secondaries first, the primary last. Reads and writes keep working meanwhile.
//
// Preview:  node scripts/db-maintenance/compact-collections.cjs
// Apply:    node scripts/db-maintenance/compact-collections.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const COLLECTIONS = ['keywordcaches', 'collectivekeyworddatas', 'trackedlistings']
const mb = n => (n / 1048576).toFixed(0) + ' MB'

async function freeSpace(db) {
  const out = {}
  for (const name of COLLECTIONS) {
    const [s] = await db.collection(name).aggregate([{ $collStats: { storageStats: {} } }]).toArray()
    out[name] = { file: s.storageStats.storageSize, free: s.storageStats.freeStorageSize ?? 0 }
  }
  return out
}

;(async () => {
  const uri = process.env.MONGODB_URI
  const main = new MongoClient(uri)
  await main.connect()
  const dbName = main.db().databaseName
  const hello = await main.db('admin').command({ hello: 1 })
  const hosts = [...(hello.hosts || [])]
  const primary = hello.primary
  const order = [...hosts.filter(h => h !== primary), primary]   // secondaries first

  const before = await freeSpace(main.db(dbName))
  console.log(`${APPLY ? 'APPLYING' : 'PREVIEW (add --apply to compact)'}  database "${dbName}", members: ${order.length}`)
  let total = 0
  for (const [name, s] of Object.entries(before)) { total += s.free; console.log(`  ${name.padEnd(24)} file ${mb(s.file).padStart(8)}   empty inside ${mb(s.free).padStart(8)}`) }
  console.log(`  about ${mb(total)} per member can go back to the disk`)
  await main.close()
  if (!APPLY) return

  // Same credentials, one direct connection per member.
  const u = new URL(uri.replace(/^mongodb\+srv:/, 'http:'))
  for (const host of order) {
    const direct = `mongodb://${u.username}:${u.password}@${host}/?tls=true&authSource=admin&directConnection=true`
    const c = new MongoClient(direct, { socketTimeoutMS: 0 })
    await c.connect()
    const isPrimary = host === primary
    for (const name of COLLECTIONS) {
      const t = Date.now()
      try {
        const r = await c.db(dbName).command({ compact: name, ...(isPrimary ? { force: true } : {}) })
        console.log(`  ${isPrimary ? 'primary  ' : 'secondary'} ${host.split('.')[0]}  ${name.padEnd(24)} freed ${mb(r.bytesFreed ?? 0).padStart(8)}  (${((Date.now() - t) / 1000).toFixed(0)} s)`)
      } catch (e) {
        console.log(`  ${host.split('.')[0]}  ${name}: FAILED ${e.message}`)
      }
    }
    await c.close()
  }
  console.log('Done. Atlas "Disk Usage" updates within a few minutes.')
})().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
