import { User } from '@/lib/models'
import { isDisposableEmail } from '@/lib/auth/disposable'
import { PENDING_SIGNUP, NOT_PENDING_SIGNUP } from '@/lib/auth/pendingSignups'
import { PLAN_SLUGS, type PlanSlug } from '@/lib/plans'

/**
 * Admin Users filters, shared by the list and by bulk actions, so "select all
 * matching" acts on exactly the users the list shows.
 */
export type EmailTypeFilter = 'all' | 'temp' | 'real'
export type AccountFilter = 'all' | 'paying' | 'granted' | 'restricted' | 'pending'
export type GroupFilter = 'all' | 'sebt' | 'notsebt'
export interface UserFilters { q?: string; plan?: PlanSlug | 'all'; emailType?: EmailTypeFilter; account?: AccountFilter; group?: GroupFilter }

export function parseUserFilters(sp: URLSearchParams | Record<string, unknown>): UserFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : (sp[k] as string | undefined)) ?? undefined
  const plan = get('plan')
  const emailType = get('emailType')
  const group = get('group')
  // `view=pending` is the older name for account=pending.
  const account = get('account') ?? (get('view') === 'pending' ? 'pending' : undefined)
  return {
    q: (get('q') || '').trim().slice(0, 200),
    plan: plan && (PLAN_SLUGS as readonly string[]).includes(plan) ? plan as PlanSlug : 'all',
    emailType: emailType === 'temp' || emailType === 'real' ? emailType : 'all',
    account: account === 'paying' || account === 'granted' || account === 'restricted' || account === 'pending' ? account : 'all',
    group: group === 'sebt' || group === 'notsebt' ? group : 'all',
  }
}

// Throwaway domains actually present among users (the full list is ~98k domains,
// far too many for a query). Recomputed at most every 5 minutes.
const g = globalThis as typeof globalThis & { __rkTempDomains?: { at: number; list: string[] } }
export async function tempDomainsInUse(): Promise<string[]> {
  if (g.__rkTempDomains && Date.now() - g.__rkTempDomains.at < 5 * 60_000) return g.__rkTempDomains.list
  const rows = await User.aggregate<{ _id: string }>([
    { $group: { _id: { $toLower: { $arrayElemAt: [{ $split: ['$email', '@'] }, 1] } } } },
  ])
  const list = rows.map(r => r._id).filter(d => d && isDisposableEmail(`x@${d}`))
  g.__rkTempDomains = { at: Date.now(), list }
  return list
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = Record<string, any>

export async function buildUserFilter(f: UserFilters): Promise<Q> {
  const and: Q[] = []
  if (f.q) {
    const rx = new RegExp(f.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const or: Q[] = [{ name: rx }, { email: rx }]
    if (/^[a-f0-9]{24}$/i.test(f.q)) or.push({ _id: f.q })
    and.push({ $or: or })
  }
  and.push(f.account === 'pending' ? PENDING_SIGNUP : NOT_PENDING_SIGNUP)
  if (f.plan && f.plan !== 'all') and.push({ plan: f.plan })
  if (f.emailType === 'temp' || f.emailType === 'real') {
    const doms = await tempDomainsInUse()
    const domainExpr = { $toLower: { $arrayElemAt: [{ $split: ['$email', '@'] }, 1] } }
    and.push(f.emailType === 'temp'
      ? { $expr: { $in: [domainExpr, doms] } }
      : { $expr: { $not: [{ $in: [domainExpr, doms] }] } })
  }
  const now = new Date()
  if (f.account === 'paying') and.push({ lsSubscriptionId: { $exists: true, $ne: null }, plan: { $ne: 'free' } })
  if (f.account === 'granted') and.push({ compExpiresAt: { $gt: now }, $or: [{ lsSubscriptionId: null }, { lsSubscriptionId: { $exists: false } }] })
  if (f.account === 'restricted') and.push({ restricted: true })
  if (f.group === 'sebt') and.push({ sebtStudent: true })
  if (f.group === 'notsebt') and.push({ sebtStudent: { $ne: true } })
  return { $and: and }
}

/** True when any filter beyond the default is active (search or a dropdown). */
export const isFiltered = (f: UserFilters) =>
  !!f.q || (f.plan && f.plan !== 'all') || (f.emailType && f.emailType !== 'all') || (f.account && f.account !== 'all') || (f.group && f.group !== 'all')
