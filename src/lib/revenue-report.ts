import { connectDB } from '@/lib/db'
import { LocalPayment } from '@/lib/models'
import { memCache } from '@/lib/cache'

/**
 * The full earnings record, month by month and year by year, for the admin.
 *
 * Card payments come straight from Lemon Squeezy (every subscription invoice and
 * subscription since the store opened), so the record is complete even for
 * payments made before our own webhook started saving them. Local payments
 * (bank / JazzCash, in PKR) come from our LocalPayment collection.
 *
 * Months are Pakistan-time calendar months (the team's day), like the rest of
 * the admin. Card amounts are GROSS (what the buyer paid, after refunds; Lemon
 * Squeezy's fee is not deducted).
 */

export interface CardMonth {
  revenueUsd: number      // paid minus refunded, USD
  payments: number        // invoices that were paid (incl. later refunded)
  newSubs: number         // first payment of a subscription
  renewals: number        // renewal payments
  planChanges: number     // mid-cycle upgrades/downgrades
  refunds: number         // invoices refunded (fully or partly)
  refundedUsd: number
  notRenewed: number      // subscriptions whose renewal date passed without payment (expired / cancelled / unpaid)
}
export interface LocalMonth {
  revenuePkr: number      // approved payments, PKR
  payments: number
  newCustomers: number    // a user's first approved local payment
  renewals: number        // a user's second or later approved local payment
  notRenewed: number      // paid period ended this month and the user never paid again
}
export interface ReportMonth { month: string; card: CardMonth; local: LocalMonth }
export interface ReportYear { year: string; card: CardMonth; local: LocalMonth }
export interface RevenueReport {
  generatedAt: string
  pkrToUsd: number | null          // live rate, null if unavailable (never guessed)
  cardSource: 'lemonsqueezy' | 'unavailable'
  months: ReportMonth[]            // newest first, every month from the first payment to now
  years: ReportYear[]              // newest first
  current: { activeCardSubs: number; cancelledEndingLater: number; activeLocal: number }
}

const LS_API = 'https://api.lemonsqueezy.com/v1'
const round2 = (n: number) => Math.round(n * 100) / 100
const pkMonth = (d: Date | string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit' }).format(new Date(d))

const emptyCard = (): CardMonth => ({ revenueUsd: 0, payments: 0, newSubs: 0, renewals: 0, planChanges: 0, refunds: 0, refundedUsd: 0, notRenewed: 0 })
const emptyLocal = (): LocalMonth => ({ revenuePkr: 0, payments: 0, newCustomers: 0, renewals: 0, notRenewed: 0 })

interface LsInvoice { billing_reason: string; status: string; total_usd: number; refunded: boolean; refunded_amount_usd: number; created_at: string; test_mode: boolean }
interface LsSub { status: string; renews_at: string | null; ends_at: string | null; test_mode: boolean }

/** Every page of a Lemon Squeezy list endpoint for this store. */
async function lsAll<T>(path: string): Promise<T[]> {
  const key = process.env.LS_API_KEY
  const store = process.env.LS_STORE_ID
  if (!key || !store) throw new Error('Lemon Squeezy is not configured')
  const out: T[] = []
  for (let page = 1; page <= 100; page++) {
    const res = await fetch(`${LS_API}${path}?filter[store_id]=${store}&page[size]=100&page[number]=${page}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/vnd.api+json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Lemon Squeezy ${path} ${res.status}`)
    const j = await res.json() as { data?: { attributes: T }[]; meta?: { page?: { lastPage?: number } } }
    out.push(...(j.data ?? []).map(d => d.attributes))
    if (page >= (j.meta?.page?.lastPage ?? 1)) break
  }
  return out
}

async function pkrRate(): Promise<number | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/PKR', { cache: 'no-store' })
    const j = await res.json() as { rates?: Record<string, number> }
    const r = j?.rates?.USD
    return typeof r === 'number' && r > 0 ? r : null
  } catch { return null }
}

async function build(): Promise<RevenueReport> {
  const now = new Date()
  const months = new Map<string, ReportMonth>()
  const at = (m: string) => {
    let row = months.get(m)
    if (!row) { row = { month: m, card: emptyCard(), local: emptyLocal() }; months.set(m, row) }
    return row
  }

  // ── Card (Lemon Squeezy) ────────────────────────────────────────────────
  let cardSource: RevenueReport['cardSource'] = 'lemonsqueezy'
  let activeCardSubs = 0, cancelledEndingLater = 0
  try {
    const [invoices, subs] = await Promise.all([
      lsAll<LsInvoice>('/subscription-invoices'),
      lsAll<LsSub>('/subscriptions'),
    ])
    for (const inv of invoices) {
      if (inv.test_mode) continue
      if (!['paid', 'refunded', 'partial_refund'].includes(inv.status)) continue   // pending / void / failed never earned
      const c = at(pkMonth(inv.created_at)).card
      const gross = (inv.total_usd ?? 0) / 100
      const refunded = (inv.refunded_amount_usd ?? 0) / 100
      c.payments++
      c.revenueUsd += gross - refunded
      if (inv.billing_reason === 'initial') c.newSubs++
      else if (inv.billing_reason === 'renewal') c.renewals++
      else c.planChanges++
      if (inv.refunded || refunded > 0) { c.refunds++; c.refundedUsd += refunded }
    }
    for (const s of subs) {
      if (s.test_mode) continue
      if (s.status === 'active' || s.status === 'on_trial') { activeCardSubs++; continue }
      // The date the renewal should have happened: ends_at for expired/cancelled,
      // renews_at for a failed renewal (past_due / unpaid).
      const due = s.ends_at ?? s.renews_at
      if (!due) continue
      if (new Date(due) <= now) at(pkMonth(due)).card.notRenewed++
      else if (s.status === 'cancelled') cancelledEndingLater++
    }
  } catch (e) {
    console.error('[revenue-report] Lemon Squeezy:', e)
    cardSource = 'unavailable'
  }

  // ── Local (bank / JazzCash) ─────────────────────────────────────────────
  await connectDB()
  const local = await LocalPayment.find({ status: 'approved' })
    .select('userId amountPkr createdAt grantedUntil').sort({ createdAt: 1 })
    .lean<{ userId: string; amountPkr: number; createdAt: Date; grantedUntil?: Date | null }[]>()
  const byUser = new Map<string, typeof local>()
  for (const p of local) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p])
  let activeLocal = 0
  for (const list of byUser.values()) {
    list.forEach((p, i) => {
      const l = at(pkMonth(p.createdAt)).local
      l.payments++
      l.revenuePkr += p.amountPkr ?? 0
      if (i === 0) l.newCustomers++; else l.renewals++
    })
    // Only the user's LATEST paid period can be "not renewed": any earlier one was
    // followed by another payment.
    const last = list[list.length - 1]
    if (last.grantedUntil) {
      if (new Date(last.grantedUntil) <= now) at(pkMonth(last.grantedUntil)).local.notRenewed++
      else activeLocal++
    }
  }

  // Every month from the first recorded one to now, so quiet months show as 0.
  const keys = [...months.keys()].sort()
  if (keys.length) {
    const [fy, fm] = keys[0].split('-').map(Number)
    const end = pkMonth(now)
    for (let y = fy, m = fm; ; m++) {
      if (m > 12) { m = 1; y++ }
      const k = `${y}-${String(m).padStart(2, '0')}`
      at(k)
      if (k >= end) break
    }
  }

  const monthRows = [...months.values()].sort((a, b) => b.month.localeCompare(a.month))
  for (const r of monthRows) { r.card.revenueUsd = round2(r.card.revenueUsd); r.card.refundedUsd = round2(r.card.refundedUsd) }

  const years = new Map<string, ReportYear>()
  for (const r of monthRows) {
    const y = r.month.slice(0, 4)
    const row = years.get(y) ?? { year: y, card: emptyCard(), local: emptyLocal() }
    for (const k of Object.keys(row.card) as (keyof CardMonth)[]) row.card[k] += r.card[k]
    for (const k of Object.keys(row.local) as (keyof LocalMonth)[]) row.local[k] += r.local[k]
    years.set(y, row)
  }
  const yearRows = [...years.values()].sort((a, b) => b.year.localeCompare(a.year))
  for (const y of yearRows) { y.card.revenueUsd = round2(y.card.revenueUsd); y.card.refundedUsd = round2(y.card.refundedUsd) }

  return {
    generatedAt: now.toISOString(),
    pkrToUsd: await pkrRate(),
    cardSource,
    months: monthRows,
    years: yearRows,
    current: { activeCardSubs, cancelledEndingLater, activeLocal },
  }
}

/** Cached for 5 minutes (Lemon Squeezy is paged; the admin page polls). `fresh` rebuilds. */
export async function revenueReport(fresh = false): Promise<RevenueReport> {
  const KEY = 'admin:revenue-report:v1'
  if (!fresh) {
    const hit = memCache.get<RevenueReport>(KEY)
    if (hit) return hit
  }
  const r = await build()
  memCache.set(KEY, r, r.cardSource === 'unavailable' ? 60 : 300)
  return r
}
