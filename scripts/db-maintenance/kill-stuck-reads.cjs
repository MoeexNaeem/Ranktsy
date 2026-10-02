// Stops snapshot-history READS that have been running for over a minute.
// Why: the app gives up on a query after 45 s, but the database keeps running it,
// so stuck history reads (some 8+ minutes) pile up and slow every other request,
// even after a pm2 restart. Nothing waits for them any more, so stopping them
// loses nothing. Only reads (query/getmore) on the two snapshot collections are
// touched; writes are never stopped. Safe to re-run.
//
// Preview:  node scripts/db-maintenance/kill-stuck-reads.cjs
// Apply:    node scripts/db-maintenance/kill-stuck-reads.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const MIN_SECS = 60
const COLLS = new Set(['test.listingsnapshots', 'test.trackedlistings'])

;(async () => {
  const c = new MongoClient(process.env.MONGODB_URI)
  await c.connect()
  const admin = c.db('admin')
  const { inprog } = await admin.command({ currentOp: 1, active: true })
  const stuck = inprog.filter(o => COLLS.has(o.ns) && (o.op === 'query' || o.op === 'getmore') && (o.secs_running ?? 0) >= MIN_SECS)
  console.log(`${stuck.length} stuck reads (over ${MIN_SECS}s):`, stuck.map(o => `${o.ns.split('.')[1]} ${o.secs_running}s`).join(', ') || 'none')
  if (APPLY) {
    let n = 0
    for (const o of stuck) {
      try { await admin.command({ killOp: 1, op: o.opid }); n++ } catch (e) { console.log('could not stop', o.opid, e.message) }
    }
    console.log(`Stopped ${n}.`)
  } else console.log('Preview only. Add --apply to stop them.')
  await c.close()
})().catch(e => { console.error(e); process.exit(1) })
