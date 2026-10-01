/**
 * Per-user API-usage tracking.
 *
 * Every Etsy request (etsyFetch / etsyAuthedFetch) and Google Ads request calls
 * recordEtsyCall() / recordGoogleCall(). Those attribute the call to the CURRENT
 * request's user via AsyncLocalStorage - set once per request by wrapping the
 * handler in runWithUsageContext() (see lib/track.ts). Counts are buffered in
 * memory and flushed to Mongo as a coalesced `$inc` at most every few seconds, so
 * a burst of API calls becomes one DB write per user/day (the cluster is slow, and
 * a write-per-call would be brutal). `$inc` is atomic, so multiple server
 * instances each flushing their own delta still sum correctly.
 *
 * One `apiusages` row per {day (UTC), userId}. `day` is the daily bucket, so the
 * numbers "reset" at 00:00 UTC simply because a new day writes a new row; history
 * is retained ~60 days (TTL on the model) so every user always has ≥7 days.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { connectDB } from '@/lib/db'
import { ApiUsage } from '@/lib/models'

export interface UsageCtx {
  userId: string
  userEmail?: string
  /** Admins and system jobs are not subject to the per-user Etsy budget. */
  exempt?: boolean
  /** The caller's plan, so the daily Etsy budget scales with what they pay. */
  plan?: string
}

const als = new AsyncLocalStorage<UsageCtx>()

/** Run `fn` with the given user attached, so any API calls inside it are attributed. */
export function runWithUsageContext<T>(ctx: UsageCtx, fn: () => T): T {
  return als.run(ctx, fn)
}

const current = (): UsageCtx => als.getStore() ?? { userId: 'anonymous' }
const dayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10)

interface Bucket {
  day: string; userId: string; userEmail?: string
  etsy: number; google: number; searches: number; cacheHits: number; apiHits: number
  images: number; imageTokens: number; imageCostUsd: number   // Gemini image generation
  credits: number   // credits spent on credit-metered tools
}

const FLUSH_MS = 4000
const buffers = new Map<string, Bucket>()   // key: `${day}|${userId}`
let timer: ReturnType<typeof setTimeout> | null = null

function bucket(): Bucket {
  const { userId, userEmail } = current()
  const day = dayKey()
  const k = `${day}|${userId}`
  let b = buffers.get(k)
  if (!b) { b = { day, userId, userEmail, etsy: 0, google: 0, searches: 0, cacheHits: 0, apiHits: 0, images: 0, imageTokens: 0, imageCostUsd: 0, credits: 0 }; buffers.set(k, b) }
  else if (userEmail && !b.userEmail) b.userEmail = userEmail
  return b
}

function schedule() { if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS) }

async function flush(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null }
  if (!buffers.size) return
  const pending = [...buffers.values()]
  buffers.clear()
  try {
    await connectDB()
    await Promise.all(pending.map(b => {
      const update: Record<string, unknown> = {
        $inc: { etsyCalls: b.etsy, googleCalls: b.google, searches: b.searches, cacheHits: b.cacheHits, apiHits: b.apiHits, imageCalls: b.images, imageTokens: b.imageTokens, imageCostUsd: b.imageCostUsd, creditsSpent: b.credits },
      }
      if (b.userEmail) update.$set = { userEmail: b.userEmail }
      return ApiUsage.updateOne({ day: b.day, userId: b.userId }, update, { upsert: true })
    }))
  } catch (e) {
    // Don't lose counts - fold them back for the next flush.
    for (const b of pending) {
      const k = `${b.day}|${b.userId}`
      const cur = buffers.get(k)
      if (!cur) { buffers.set(k, b); continue }
      cur.etsy += b.etsy; cur.google += b.google; cur.searches += b.searches; cur.cacheHits += b.cacheHits; cur.apiHits += b.apiHits
      cur.images += b.images; cur.imageTokens += b.imageTokens; cur.imageCostUsd += b.imageCostUsd
      cur.credits += b.credits
    }
    console.error('[Usage] flush failed:', e)
  }
}

export function recordEtsyCall(n = 1): void { bucket().etsy += n; schedule() }
export function recordGoogleCall(n = 1): void { bucket().google += n; schedule() }
export function recordSearch(n = 1): void { bucket().searches += n; schedule() }
export function recordCacheHit(n = 1): void { bucket().cacheHits += n; schedule() }
export function recordApiHit(n = 1): void { bucket().apiHits += n; schedule() }
/** Record a Gemini image generation: image count, token total, and USD cost. */
export function recordImage(images: number, tokens: number, costUsd: number): void {
  const b = bucket(); b.images += images; b.imageTokens += tokens; b.imageCostUsd += costUsd; schedule()
}
/** Record credits spent on a credit-metered tool for the current request's user. */
export function recordCredits(n = 1): void { bucket().credits += n; schedule() }

/** Etsy+Google calls attributed to the current request so far (for cache-vs-live detection). */
export function peekApiCalls(): number { const b = bucket(); return b.etsy + b.google }

export async function flushUsage(): Promise<void> { await flush() }

// ─── Per-user daily Etsy budget (anti-scraping) ──────────────────────────────
// Every Etsy request a signed-in user causes is already counted above. Without a
// ceiling, any account (free accounts are created in seconds) could script the
// Etsy-backed endpoints (e.g. listing-reviews: up to 100 Etsy calls per request,
// no credits involved) and drain the shared Etsy quota for everyone.
//
// The cap is per user per UTC day, shared across all PM2 workers: the flushed
// total from Mongo (re-read at most every 15 s) plus this worker's unflushed
// count. It is set far above real use (the heaviest genuine user measured
// ~5,800 calls/day) so it only ever stops runaway scripts. Admins and system jobs
// are exempt. ETSY_USER_DAILY_CAP=0 disables it.
//
// The budget scales with the plan: this is the SERVER-side enforcement for the
// tools whose credits are charged by the browser. The server cannot tell "a new
// search" from "opening a detail panel" on shared routes without trusting the
// client, but it CAN cap what each account consumes in real Etsy calls, and that
// cap now grows with what the account pays. Defaults are deliberately generous
// (2026-10-01 measurements under-count users: ~100k calls/day were unattributed
// until the usage-labelling fix); tighten per plan with ETSY_DAILY_CAP_<PLAN>,
// e.g. ETSY_DAILY_CAP_FREE=2000, once a few days of correct data exist.
export const ETSY_USER_DAILY_CAP = Math.max(0, Number(process.env.ETSY_USER_DAILY_CAP ?? 15000))
const PLAN_DEFAULT_CAP: Record<string, number> = {
  free: 5000, starter: 8000, basic: 12000, pro: 15000, 'pro-1yr': 15000,
  business: 20000, agency: 25000, enterprise: 15000, custom: 30000,
}
export function etsyDailyCapFor(plan?: string): number {
  if (!ETSY_USER_DAILY_CAP) return 0
  const p = (plan || 'free').toLowerCase()
  const env = Number(process.env[`ETSY_DAILY_CAP_${p.replace(/[^a-z0-9]/g, '_').toUpperCase()}`])
  if (Number.isFinite(env) && env >= 0) return env
  return PLAN_DEFAULT_CAP[p] ?? ETSY_USER_DAILY_CAP
}

export class EtsyBudgetError extends Error {
  constructor() {
    super('You have reached today’s data limit for your account. It resets at midnight UTC. If you need more, please contact support.')
    this.name = 'EtsyBudgetError'
  }
}

const budgetBase = new Map<string, { calls: number; at: number }>()
const warned = new Set<string>()

/** Throws EtsyBudgetError when the current user has used up today's Etsy budget. */
export async function assertEtsyBudget(): Promise<void> {
  const ctx = als.getStore()
  // Logged-out calls cannot reach Etsy routes (proxy login gate); system jobs and
  // admins are trusted.
  if (!ctx || ctx.exempt || ctx.userId === 'anonymous' || ctx.userId.startsWith('system:')) return
  const cap = etsyDailyCapFor(ctx.plan)
  if (!cap) return
  const day = dayKey()
  const k = `${day}|${ctx.userId}`
  let base = budgetBase.get(k)
  if (!base || Date.now() - base.at > 15_000) {
    try {
      await connectDB()
      const row = await ApiUsage.findOne({ day, userId: ctx.userId }).select('etsyCalls').lean<{ etsyCalls?: number }>()
      base = { calls: row?.etsyCalls ?? 0, at: Date.now() }
    } catch {
      base = { calls: base?.calls ?? 0, at: Date.now() }   // DB blip: never block on it
    }
    budgetBase.set(k, base)
    if (budgetBase.size > 5000) budgetBase.clear()          // bounded memory
  }
  const used = base.calls + (buffers.get(k)?.etsy ?? 0)
  if (used >= cap) {
    if (!warned.has(k)) { warned.add(k); console.warn(`[usage] Etsy daily budget reached: ${ctx.userEmail ?? ctx.userId} (${used} calls)`) }
    throw new EtsyBudgetError()
  }
}
