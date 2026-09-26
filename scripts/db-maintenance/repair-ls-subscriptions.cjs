// One-time: repair card (Lemon Squeezy) customers saved by the old webhook bug.
// On a "payment success" event the old code stored the INVOICE id as the user's
// subscription id and the invoice status ('paid') as their subscription status,
// and could record a payment under plan 'free'. This reads each affected user's
// real subscription from Lemon Squeezy and stores its true id, status, variant and
// renewal date. Plans are only changed to what Lemon Squeezy says they paid for.
//
// Preview:  node scripts/db-maintenance/repair-ls-subscriptions.cjs
// Apply:    node scripts/db-maintenance/repair-ls-subscriptions.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient, ObjectId } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const H = { Authorization: 'Bearer ' + process.env.LS_API_KEY, Accept: 'application/vnd.api+json' }
const VARIANT_PLAN = Object.fromEntries(
  [['starter', 'LS_VARIANT_STARTER'], ['basic', 'LS_VARIANT_BASIC'], ['pro', 'LS_VARIANT_PRO'], ['pro-1yr', 'LS_VARIANT_PRO_1YR'],
   ['business', 'LS_VARIANT_BUSINESS'], ['agency', 'LS_VARIANT_AGENCY'], ['enterprise', 'LS_VARIANT_ENTERPRISE']]
    .map(([plan, env]) => [String(process.env[env]), plan]))
const ls = async path => (await fetch('https://api.lemonsqueezy.com/v1' + path, { headers: H })).json()
const rank = s => ({ active: 0, on_trial: 1, past_due: 2, paused: 3, cancelled: 4, unpaid: 5, expired: 6 }[s] ?? 9)

;(async () => {
  if (!process.env.LS_API_KEY || !process.env.LS_STORE_ID) throw new Error('LS_API_KEY / LS_STORE_ID missing')
  const c = new MongoClient(process.env.MONGODB_URI)
  await c.connect()
  const db = c.db()
  console.log(APPLY ? 'APPLYING' : 'PREVIEW (add --apply to save)')

  // Every subscription in the store, newest first.
  const subs = []
  for (let page = 1; ; page++) {
    const j = await ls(`/subscriptions?filter[store_id]=${process.env.LS_STORE_ID}&page[size]=100&page[number]=${page}`)
    subs.push(...(j.data || []))
    if (!j.meta?.page || page >= j.meta.page.lastPage) break
  }
  const byUser = new Map()
  const byEmail = new Map()
  const push = (m, k, s) => { if (!k) return; const a = m.get(k) || []; a.push(s); m.set(k, a) }
  for (const s of subs) {
    push(byEmail, String(s.attributes.user_email || '').toLowerCase(), s)
  }
  console.log(`Lemon Squeezy subscriptions: ${subs.length}`)

  const users = await db.collection('users').find(
    { lsSubscriptionId: { $ne: null }, subscriptionStatus: 'paid' },
    { projection: { email: 1, plan: 1, lsSubscriptionId: 1, lsVariantId: 1, subscriptionStatus: 1, planRenewsAt: 1 } },
  ).toArray()
  console.log(`Users with the bad "paid" status: ${users.length}\n`)

  let fixed = 0, skipped = 0
  for (const u of users) {
    const own = subs.filter(s => String(s.id) === String(u.lsSubscriptionId))
    const cands = (own.length ? own : byEmail.get(String(u.email).toLowerCase()) || [])
      .sort((a, b) => rank(a.attributes.status) - rank(b.attributes.status) || String(b.attributes.created_at).localeCompare(String(a.attributes.created_at)))
    const s = cands[0]
    if (!s) { skipped++; console.log(`  SKIP ${u.email}: no subscription found in Lemon Squeezy`); continue }
    const a = s.attributes
    const plan = VARIANT_PLAN[String(a.variant_id)]
    const set = {
      lsSubscriptionId: String(s.id),
      subscriptionStatus: a.status,
      lsVariantId: String(a.variant_id),
      ...(a.renews_at ? { planRenewsAt: new Date(a.renews_at) } : {}),
      ...(plan ? { plan } : {}),
    }
    console.log(`  ${u.email}: sub ${u.lsSubscriptionId} -> ${set.lsSubscriptionId}, status paid -> ${a.status}, plan ${u.plan} -> ${plan || u.plan}`)
    if (APPLY) await db.collection('users').updateOne({ _id: u._id }, { $set: set })
    fixed++
  }

  // Payment rows recorded under plan 'free'.
  const badPays = await db.collection('payments').find({ plan: 'free' }).toArray()
  for (const p of badPays) {
    const s = subs.find(x => String(x.id) === String(p.subscriptionId))
    const plan = s && VARIANT_PLAN[String(s.attributes.variant_id)]
    console.log(`  payment ${p.invoiceId} ($${p.amountUsd}): plan free -> ${plan || '(unknown, left as is)'}`)
    if (APPLY && plan) await db.collection('payments').updateOne({ _id: p._id }, { $set: { plan } })
  }

  console.log(`\n${fixed} users ${APPLY ? 'repaired' : 'to repair'}, ${skipped} skipped, ${badPays.length} payment row(s) checked.`)
  await c.close()
})().catch(e => { console.error(e); process.exit(1) })
