/**
 * Billing check (admin): does every Lemon Squeezy subscription give its buyer the
 * plan they paid for, and does access end when the subscription does?
 *
 * Reads every subscription from Lemon Squeezy and matches each one to a Rankkw
 * account by the ids our webhook saves (subscription id, then customer id), and
 * only then by email, which is weak: buyers can type another email at checkout.
 * Nothing is changed here; `applySubscription` fixes one row on request.
 */
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { planForVariant, effectivePlan } from '@/lib/plans'

const LS_API = 'https://api.lemonsqueezy.com/v1'

interface LsSubAttrs {
  status: string; user_email: string; user_name: string; customer_id: number; product_name: string; variant_name: string
  variant_id: number; renews_at: string | null; ends_at: string | null; created_at: string; test_mode: boolean
}
export interface LsSub extends LsSubAttrs { id: string }

async function allSubscriptions(): Promise<LsSub[]> {
  const key = process.env.LS_API_KEY
  const store = process.env.LS_STORE_ID
  if (!key || !store) throw new Error('Lemon Squeezy is not configured')
  const out: LsSub[] = []
  for (let page = 1; page <= 100; page++) {
    const res = await fetch(`${LS_API}/subscriptions?filter[store_id]=${store}&page[size]=100&page[number]=${page}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/vnd.api+json' }, cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Lemon Squeezy /subscriptions ${res.status}`)
    const j = await res.json() as { data?: { id: string; attributes: LsSubAttrs }[]; meta?: { page?: { lastPage?: number } } }
    out.push(...(j.data ?? []).map(d => ({ id: String(d.id), ...d.attributes })))
    if (page >= (j.meta?.page?.lastPage ?? 1)) break
  }
  return out
}

export type Problem =
  | 'paid_no_access'        // live subscription, the matched account is on Free
  | 'not_linked'            // live subscription no account carries (webhook never applied); matched by email at best
  | 'no_account'            // live subscription, no account at all
  | 'wrong_plan'            // account plan is LOWER than the plan bought
  | 'paying_twice'          // account has a higher plan (usually Pro 1-Year by bank / JazzCash) while this card subscription keeps renewing
  | 'ended_still_access'    // subscription ended, the account still has the paid plan

export interface CheckRow {
  subId: string; status: string; email: string; product: string; plan: string | null
  createdAt: string; renewsAt: string | null; endsAt: string | null
  matchedBy: 'subscription' | 'customer' | 'email' | null
  user: { id: string; email: string; name: string; plan: string; effectivePlan: string; subscriptionStatus: string | null } | null
  problem: Problem | null
}
export interface BillingCheck {
  checkedAt: string
  subscriptions: number
  live: number
  ok: number
  problems: Record<Problem, number>
  rows: CheckRow[]   // problems first
}

const LIVE = new Set(['active', 'on_trial', 'past_due', 'cancelled'])
const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, basic: 2, pro: 3, 'pro-1yr': 4, business: 5, agency: 6, enterprise: 7, custom: 8 }
/** A subscription that still entitles its buyer to the plan right now. */
function isLive(s: LsSub, now: number): boolean {
  if (!LIVE.has(s.status)) return false
  if (s.status === 'cancelled') return !!s.ends_at && new Date(s.ends_at).getTime() > now
  return true
}

type U = { _id: unknown; email: string; name?: string; plan?: string; subscriptionStatus?: string; planRenewsAt?: Date; compExpiresAt?: Date; lsSubscriptionId?: string; lsCustomerId?: string }

export async function runBillingCheck(): Promise<BillingCheck> {
  const now = Date.now()
  const subs = (await allSubscriptions()).filter(s => !s.test_mode)
  await connectDB()
  const subIds = subs.map(s => s.id)
  const custIds = [...new Set(subs.map(s => String(s.customer_id)))]
  const emails = [...new Set(subs.map(s => (s.user_email ?? '').toLowerCase()).filter(Boolean))]
  const users = await User.find({ $or: [{ lsSubscriptionId: { $in: subIds } }, { lsCustomerId: { $in: custIds } }, { email: { $in: emails } }] })
    .select('email name plan subscriptionStatus planRenewsAt compExpiresAt lsSubscriptionId lsCustomerId').lean<U[]>()
  const bySub = new Map<string, U>(), byCust = new Map<string, U>(), byEmail = new Map<string, U>()
  for (const u of users) {
    if (u.lsSubscriptionId) bySub.set(u.lsSubscriptionId, u)
    if (u.lsCustomerId) byCust.set(u.lsCustomerId, u)
    byEmail.set(u.email.toLowerCase(), u)
  }

  const rows: CheckRow[] = subs.map(s => {
    let u: U | undefined, matchedBy: CheckRow['matchedBy'] = null
    if ((u = bySub.get(s.id))) matchedBy = 'subscription'
    else if ((u = byCust.get(String(s.customer_id)))) matchedBy = 'customer'
    else if ((u = byEmail.get((s.user_email ?? '').toLowerCase()))) matchedBy = 'email'
    const plan = planForVariant(s.variant_id)
    const live = isLive(s, now)
    const rank = (p?: string | null) => PLAN_RANK[p ?? 'free'] ?? 0
    const eff = u ? effectivePlan(u) : null
    let problem: Problem | null = null
    if (live) {
      if (!u) problem = 'no_account'
      else if (eff === 'free') problem = matchedBy === 'email' ? 'not_linked' : 'paid_no_access'
      else if (matchedBy === 'email') problem = 'not_linked'
      // A higher plan than the card one is not an error to "fix" (that would be a
      // downgrade): it is a customer paying twice, worth telling them to cancel.
      else if (plan && u.plan !== plan && u.lsSubscriptionId === s.id) problem = rank(u.plan) > rank(plan) ? 'paying_twice' : 'wrong_plan'
    } else if (u && matchedBy === 'subscription' && eff !== 'free' && ['expired', 'unpaid'].includes(s.status)) {
      problem = 'ended_still_access'
    }
    return {
      subId: s.id, status: s.status, email: s.user_email, product: `${s.product_name}${s.variant_name && s.variant_name !== 'Default' ? ` (${s.variant_name})` : ''}`,
      plan, createdAt: s.created_at, renewsAt: s.renews_at, endsAt: s.ends_at, matchedBy,
      user: u ? { id: String(u._id), email: u.email, name: u.name ?? '', plan: u.plan ?? 'free', effectivePlan: eff ?? 'free', subscriptionStatus: u.subscriptionStatus ?? null } : null,
      problem,
    }
  })
  const problems: Record<Problem, number> = { paid_no_access: 0, not_linked: 0, no_account: 0, wrong_plan: 0, paying_twice: 0, ended_still_access: 0 }
  for (const r of rows) if (r.problem) problems[r.problem]++
  const live = subs.filter(s => isLive(s, now)).length
  rows.sort((a, b) => (a.problem ? 0 : 1) - (b.problem ? 0 : 1) || b.createdAt.localeCompare(a.createdAt))
  return {
    checkedAt: new Date().toISOString(), subscriptions: subs.length, live,
    ok: rows.filter(r => !r.problem && isLive(subs.find(s => s.id === r.subId)!, now)).length,
    problems, rows,
  }
}

/**
 * Give one account the plan of a live Lemon Squeezy subscription (what the
 * webhook should have done). Re-reads the subscription from Lemon Squeezy first.
 */
export async function applySubscription(subId: string, userId: string): Promise<{ ok: boolean; message: string }> {
  const key = process.env.LS_API_KEY
  if (!key) return { ok: false, message: 'Lemon Squeezy is not configured' }
  const res = await fetch(`${LS_API}/subscriptions/${encodeURIComponent(subId)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/vnd.api+json' }, cache: 'no-store',
  })
  if (!res.ok) return { ok: false, message: `Lemon Squeezy answered ${res.status}` }
  const j = await res.json() as { data?: { attributes?: LsSubAttrs } }
  const s = j.data?.attributes
  if (!s) return { ok: false, message: 'Subscription not found' }
  if (!isLive({ ...s, id: subId }, Date.now())) {
    // Ended (expired / unpaid): end the access it was still giving, as the webhook should have.
    await connectDB()
    const r = await User.updateOne({ _id: userId, lsSubscriptionId: subId }, { $set: { subscriptionStatus: s.status === 'unpaid' ? 'unpaid' : 'expired', plan: 'free' } })
    return r.matchedCount ? { ok: true, message: `Access ended (subscription ${s.status})` } : { ok: false, message: 'That account is not on this subscription' }
  }
  const plan = planForVariant(s.variant_id)
  if (!plan) return { ok: false, message: `Variant ${s.variant_id} is not mapped to a plan (LS_VARIANT_* env)` }
  await connectDB()
  const r = await User.updateOne({ _id: userId }, {
    $set: {
      plan, subscriptionStatus: s.status, lsSubscriptionId: subId, lsCustomerId: String(s.customer_id),
      lsVariantId: String(s.variant_id), ...(s.renews_at ? { planRenewsAt: new Date(s.renews_at) } : {}),
      creditsUsedToday: 0, searchCount: 0,
    },
  })
  return r.matchedCount ? { ok: true, message: `Plan set to ${plan}` } : { ok: false, message: 'Account not found' }
}
