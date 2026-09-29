/**
 * Per-user search rate gate for the dashboard tools.
 *
 * Rule: a SIGNED-IN user may run SEARCH_LIMIT_USER searches within a rolling hour
 * (default 150); anonymous/IP callers get SEARCH_LIMIT_ANON (default 25). Going over
 * asks for a reCAPTCHA, and solving it clears the counter. The point is to stop bots
 * and scrapers, not to interrupt real customers, so the signed-in limit is generous
 * and tunable without a deploy (SEARCH_LIMIT_USER / SEARCH_LIMIT_ANON env vars).
 *
 * Storage is an in-process Map - fine for a single Node host (this app's setup).
 * If it ever runs multi-instance, back this with Redis/Mongo; the limit would
 * then just be enforced per-instance until then (fails safe, never over-blocks a
 * legitimate user beyond their own instance).
 */
const envLimit = (name: string, fallback: number) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}
/** Signed-in users: generous, so normal research never hits a captcha. */
export const SEARCH_LIMIT_USER = envLimit('SEARCH_LIMIT_USER', 150)
/** Anonymous callers (by IP): tight, this is the bot surface. */
export const SEARCH_LIMIT_ANON = envLimit('SEARCH_LIMIT_ANON', 25)
/** Back-compat for callers that just want "the" limit. */
export const SEARCH_LIMIT = SEARCH_LIMIT_USER
const limitFor = (key: string) => (key.startsWith('u:') ? SEARCH_LIMIT_USER : SEARCH_LIMIT_ANON)
const WINDOW_MS = 60 * 60 * 1000   // 1 hour

interface Entry { count: number; windowStart: number }
const store = new Map<string, Entry>()

function current(key: string): Entry {
  const now = Date.now()
  let e = store.get(key)
  if (!e || now - e.windowStart > WINDOW_MS) {
    e = { count: 0, windowStart: now }
    store.set(key, e)
  }
  return e
}

/** True if this key may run another search right now (under the hourly limit). */
export function isSearchAllowed(key: string): boolean {
  return current(key).count < limitFor(key)
}

/** Count one search against the key's current window. */
export function recordSearch(key: string): void {
  current(key).count++
}

/** How many searches remain in the current window (for optional UI hints). */
export function searchesRemaining(key: string): number {
  return Math.max(0, limitFor(key) - current(key).count)
}

/** Reset the window - called after a valid captcha, granting the next 25. */
export function clearSearchLimit(key: string): void {
  store.set(key, { count: 0, windowStart: Date.now() })
}

// Opportunistic cleanup so the Map can't grow unbounded over a long uptime.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, e] of store) if (now - e.windowStart > WINDOW_MS) store.delete(k)
  }, WINDOW_MS).unref?.()
}

// ─── Shared across every server process ──────────────────────────────────────
// The Map above is per PM2 worker, so with 4 workers one account really got 4x
// the limit (a scraper ran 581 searches in one hour on 2026-09-29). These count
// in one shared store so the limit is the same whichever worker answers: Upstash
// Redis when a real URL is configured, otherwise MongoDB (always available). If
// the store fails or is slow, they fall back to the per-worker Map.
import { Redis } from '@upstash/redis'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

/** Browser-extension lookups (it cannot show a captcha, so a separate, higher cap). */
export const SEARCH_LIMIT_EXT = envLimit('SEARCH_LIMIT_EXT', 150)

let redis: Redis | null | undefined
function redisStore(): Redis | null {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? ''
    try {
      redis = /^https:\/\//.test(url) && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null
    } catch { redis = null }
  }
  return redis
}
const hourSlot = () => Math.floor(Date.now() / WINDOW_MS)
const slotKey = (key: string) => `rk:search:${key}:${hourSlot()}`
const within = <T>(p: Promise<T>, ms = 800) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('limit store timeout')), ms))])

// MongoDB: one tiny doc per (key, hour), removed by a TTL index after two hours.
let ttlReady = false
async function mongoCounters() {
  await connectDB()
  const col = mongoose.connection.db!.collection<{ _id: string; n: number; expiresAt: Date }>('searchlimits')
  if (!ttlReady) { ttlReady = true; void col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {}) }
  return col
}

/** Add `by` to this hour's shared counter for `key` and return the new total. */
async function bump(key: string, by: number): Promise<number> {
  const r = redisStore()
  if (r) {
    const k = slotKey(key)
    const n = await within(r.incrby(k, by))
    if (n === by) void r.expire(k, Math.ceil(WINDOW_MS / 1000) + 60).catch(() => {})
    return n
  }
  const col = await mongoCounters()
  const doc = await within(col.findOneAndUpdate(
    { _id: slotKey(key) },
    { $inc: { n: by }, $setOnInsert: { expiresAt: new Date(Date.now() + 2 * WINDOW_MS) } },
    { upsert: true, returnDocument: 'after' },
  ))
  return doc?.n ?? by
}

// Last shared total this worker saw per key, so a normal search never waits on
// the store: it is decided from this estimate and the store is updated in the
// background. Only a key at or over its limit waits for the store's real number
// (which is how a captcha solved on another worker is picked up).
const known = new Map<string, { slot: number; n: number }>()

/**
 * Count one search for `key` if it is under `limit` this hour. Returns false (and
 * counts nothing) when the key is over the limit. May overshoot by a few searches
 * when several workers serve the same key at once; fine for stopping scrapers.
 */
export async function takeSearch(key: string, limit = limitFor(key)): Promise<boolean> {
  const slot = hourSlot()
  const seen = known.get(key)
  let estimate = seen && seen.slot === slot ? seen.n : 0
  try {
    if (estimate >= limit) {
      estimate = await bump(key, 0)          // confirm against the shared store
      known.set(key, { slot, n: estimate })
      if (estimate >= limit) return false
    }
    known.set(key, { slot, n: estimate + 1 })
    void bump(key, 1).then(n => known.set(key, { slot, n })).catch(() => {})
    if (known.size > 20_000) known.clear()   // bound memory; estimates just restart
    return true
  } catch { /* shared store down or slow: per-worker fallback */ }
  if (current(key).count >= limit) return false
  recordSearch(key)
  return true
}

/** Reset `key` everywhere (after a solved captcha). */
export async function resetSearches(key: string): Promise<void> {
  clearSearchLimit(key)
  known.delete(key)
  try {
    const r = redisStore()
    if (r) await within(r.del(slotKey(key)))
    else await within((await mongoCounters()).deleteOne({ _id: slotKey(key) }))
  } catch { /* the hour slot expires on its own */ }
}

// ─── Human check: a captcha every HUMAN_CHECK_EVERY new searches ─────────────
// Counts NEW searches per account (a search = one tool + query per UTC day; a
// refresh, a revisit of today's keyword, paging, sorting and a search's own
// side panels are the same search and never count). At the limit, the next new
// search is refused until the user solves a reCAPTCHA, which resets the count.
// Stored in MongoDB so every server process sees the same count.

/** New searches allowed between two captchas. */
export const HUMAN_CHECK_EVERY = envLimit('HUMAN_CHECK_EVERY', 10)
const HUMAN_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface HumanDoc { _id: string; n: number; seen: string[]; expiresAt: Date }
let humanTtlReady = false
async function humanCounters() {
  await connectDB()
  const col = mongoose.connection.db!.collection<HumanDoc>('humanchecks')
  if (!humanTtlReady) { humanTtlReady = true; void col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {}) }
  return col
}
const humanId = (key: string) => `hc:${key}`
const todayFp = (fp: string) => `${new Date().toISOString().slice(0, 10)}|${fp.toLowerCase().trim().slice(0, 300)}`

/**
 * 'ok' = allowed (counted if new), 'captcha' = this new search needs a solved
 * captcha first. Repeats of an already-counted search are always 'ok'.
 */
export async function takeHumanSearch(key: string, fingerprint: string, every = HUMAN_CHECK_EVERY): Promise<'ok' | 'captcha'> {
  const col = await humanCounters()
  const _id = humanId(key)
  const fp = todayFp(fingerprint)
  const isRepeat = async () => !!(await col.findOne({ _id, seen: fp }, { projection: { _id: 1 } }))
  if (await isRepeat()) return 'ok'
  try {
    // Atomic: only counts while under the limit and only for a search not seen yet.
    // If the filter does not match an existing doc, the upsert's insert collides on
    // _id (11000): either the account is at the limit, or a parallel request just
    // counted this same search.
    await col.updateOne(
      { _id, n: { $lt: every }, seen: { $ne: fp } },
      { $inc: { n: 1 }, $push: { seen: { $each: [fp], $slice: -400 } }, $set: { expiresAt: new Date(Date.now() + HUMAN_TTL_MS) } },
      { upsert: true },
    )
    return 'ok'
  } catch (e) {
    if ((e as { code?: number })?.code !== 11000) throw e
    return (await isRepeat()) ? 'ok' : 'captcha'
  }
}

/** A captcha was solved: the next HUMAN_CHECK_EVERY new searches are allowed. */
export async function resetHumanSearch(key: string): Promise<void> {
  const col = await humanCounters()
  await col.updateOne({ _id: humanId(key) }, { $set: { n: 0, expiresAt: new Date(Date.now() + HUMAN_TTL_MS) } })
}
