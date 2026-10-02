require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient } = require('mongodb')
;(async () => {
  const c = new MongoClient(process.env.MONGODB_URI); await c.connect()
  const a = c.db('admin')
  for (let k = 0; k < 3; k++) {
    const r = await a.command({ currentOp: 1, active: true })
    const slow = r.inprog.filter(o => o.ns && !o.ns.startsWith('local') && !o.ns.startsWith('admin') && (o.secs_running||0) >= 3)
    for (const o of slow.slice(0, 8)) {
      const cmd = o.command || {}
      const orig = o.cursor?.originatingCommand || {}
      const show = o.op === 'getmore' ? orig : cmd
      const shape = JSON.stringify(show, (key, v) => Array.isArray(v) && v.length > 3 ? `[${v.length} items]` : v).slice(0, 230)
      console.log(o.secs_running + 's', o.op, o.ns, o.planSummary || '', shape)
    }
    console.log('---')
    await new Promise(r => setTimeout(r, 8000))
  }
  await c.close()
})().catch(e => { console.error(e.message); process.exit(1) })
