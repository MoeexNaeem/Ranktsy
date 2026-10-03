/**
 * Google Ads API - Keyword Planner (real Google search volume + geography).
 * Uses the REST interface. No SDK.
 *
 * Required env (all must be set for Google data to activate; otherwise every
 * function below no-ops and the app falls back to Etsy-only data):
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_REFRESH_TOKEN         ← mint via /api/google/oauth/connect
 *   GOOGLE_ADS_CUSTOMER_ID           ← your Google Ads account id (10 digits, no dashes)
 * Optional:
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID     ← manager (MCC) id, if the above sits under one
 *   GOOGLE_ADS_API_VERSION           ← defaults to v24; bump if Google sunsets it
 *   GOOGLE_ADS_FRESH_DAYS            ← how long a cached Planner answer is reused (default 30)
 *
 * ── Why this file caches so hard (the "all Google stats blank" outage) ─────────
 * A developer token with BASIC access gets 15,000 operations per DAY for the whole
 * app. One Global keyword search used to fire ~30 Planner requests (7 countries for
 * the stats, 7 again for trends, 7 for the country chart, 7 for related, ideas...),
 * and 429s were retried, which also counts. A few hundred searches a day exhausted
 * the token and every Google panel went blank for everyone until midnight PT.
 *
 * Now:
 *  1. Every Planner answer is stored per (keyword, country) in Mongo (GoogleAdsCache)
 *     and reused for GOOGLE_ADS_FRESH_DAYS by every user and PM2 worker. Global, the
 *     country chart and the trend line all read the SAME per-country rows, so a new
 *     keyword costs 7 requests once, and 0 afterwards.
 *  2. Only keywords missing from the cache are requested (batched, one request).
 *  3. A daily-quota 429 (rateScope DEVELOPER) locks Google calls app-wide until the
 *     retry time Google gives us, instead of hammering it. A per-second 429
 *     (rateScope ACCOUNT) waits the delay Google asks for, once. Google's retry time
 *     can be far longer than the real outage (a 22h lock was seen while the quota
 *     was fine), so while locked one real request is let through every
 *     QUOTA_PROBE_MS as a probe; if it succeeds the lock is cleared everywhere.
 *  4. When Google can't answer, the last stored numbers are served (stale beats blank),
 *     and callers get `meta.quota` / `meta.failed` so the UI can say WHY data is missing.
 *  5. The Basic Access cap is on the Keyword Planner endpoints (generateKeyword*); plain
 *     account reads keep working while it is exhausted. So the lock and the probe apply
 *     to Planner calls only. Nothing is rationed before Google says the cap is hit:
 *     users always get every panel; our own op count is shown to admins, never enforced.
 *  6. Global volume is ONE request over all tracked countries (not 7 per-country ones),
 *     and every keyword-ideas answer also seeds the per-country metrics cache.
 *
 * Real fix for scale: apply for STANDARD access on the developer token (no daily
 * operation cap): Google Ads UI → Tools → API Center → "Apply for Standard Access".
 */
import { recordGoogleCall } from '@/lib/usage'
import { singleFlight } from '@/lib/concurrency'
import { workerCount } from '@/lib/workers'
import { memCache } from '@/lib/cache'
import { connectDB } from '@/lib/db'
import { GoogleAdsCache } from '@/lib/models'

const V = process.env.GOOGLE_ADS_API_VERSION || 'v24'
const FRESH_MS = (Number(process.env.GOOGLE_ADS_FRESH_DAYS) > 0 ? Number(process.env.GOOGLE_ADS_FRESH_DAYS) : 30) * 86400_000
// Keywords Google has no data for are re-asked sooner (they may start getting volume).
const EMPTY_FRESH_MS = 7 * 86400_000
const digits = (s?: string) => (s ?? '').replace(/\D/g, '')

export function isGoogleAdsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  )
}

// ─── Country → Google geoTargetConstant id + display + doughnut colour ─────────
// Used by the "Searchers by Country" breakdown and the Global aggregate.
export const GEO_TARGETS: Record<string, { id: string; name: string; color: string }> = {
  US: { id: '2840', name: 'United States', color: '#FB5E09' },
  GB: { id: '2826', name: 'United Kingdom', color: '#3D3E3B' },
  CA: { id: '2124', name: 'Canada', color: '#6E6E64' },
  AU: { id: '2036', name: 'Australia', color: '#B9791A' },
  DE: { id: '2276', name: 'Germany', color: '#5A5A5A' },
  FR: { id: '2250', name: 'France', color: '#CF463A' },
  IN: { id: '2356', name: 'India', color: '#2E7D32' },
}

// ─── User-selectable country filter (like eRank's) → geoTargetConstant ─────────
// `id: null` = Global. Search volume, CPC and competition are all geo-specific, so
// this genuinely changes the Google numbers; Etsy metrics are marketplace-global.
export const KEYWORD_GEOS: Record<string, { id: string | null; name: string; flag: string }> = {
  US:  { id: '2840', name: 'United States', flag: '🇺🇸' },
  GB:  { id: '2826', name: 'United Kingdom', flag: '🇬🇧' },
  AU:  { id: '2036', name: 'Australia',      flag: '🇦🇺' },
  CA:  { id: '2124', name: 'Canada',         flag: '🇨🇦' },
  FR:  { id: '2250', name: 'France',         flag: '🇫🇷' },
  DE:  { id: '2276', name: 'Germany',        flag: '🇩🇪' },
  IN:  { id: '2356', name: 'India',          flag: '🇮🇳' },
  GLO: { id: null,   name: 'Global',         flag: '🌐' },
}
/** Normalise an incoming country code to a valid key (defaults to US). */
export function normalizeGeo(iso?: string | null): string {
  const k = (iso ?? '').toUpperCase()
  return KEYWORD_GEOS[k] ? k : 'US'
}
// Resolve a selectable country code to a geoTargetConstant id, or null for Global.
function geoIdFor(iso: string): string | null {
  return iso in KEYWORD_GEOS ? KEYWORD_GEOS[iso].id : '2840'
}
const LANG_EN = 'languageConstants/1000'

// ─── Status out-param ─────────────────────────────────────────────────────────
/** Out-param so callers can tell a FAILED Google lookup apart from a keyword that
 *  genuinely has no data - the two must be cached (and explained) very differently. */
export interface GoogleMetricsMeta {
  /** Google could not answer for at least one keyword (after using any stored data). */
  failed?: boolean
  /** The failure is the daily Google Ads quota. */
  quota?: boolean
  /** ISO time Google calls resume (quota lockouts only). */
  retryAt?: string | null
  /** Some numbers came from an older stored answer because Google was unavailable. */
  stale?: boolean
}

export type GoogleDataStatus = 'ok' | 'quota' | 'error' | 'unconfigured'
/** Collapse a meta into the status string the API responses/UI use. */
export function googleStatusOf(meta: GoogleMetricsMeta): GoogleDataStatus {
  if (!isGoogleAdsConfigured()) return 'unconfigured'
  if (meta.quota) return 'quota'
  if (meta.failed) return 'error'
  return 'ok'
}

export class GoogleAdsError extends Error {
  /**
   * Google's own error enums for this failure, e.g.
   * `authenticationError.NOT_ADS_USER`, `authorizationError.CUSTOMER_NOT_ENABLED`.
   *
   * Callers must branch on THESE, not on the human message: the message is prose
   * written by Google ("User in the cookie is not a valid Ads user.") and does
   * not contain the enum, so string matching silently misclassifies.
   */
  constructor(
    message: string,
    readonly kind: 'quota' | 'rate' | 'auth' | 'http',
    readonly retryAt: number | null = null,
    readonly codes: string[] = [],
  ) {
    super(message)
  }

  /** True when any of Google's enums for this failure matches `re`. */
  hasCode(re: RegExp): boolean {
    return this.codes.some(c => re.test(c))
  }
}

// ─── Keyword Planner quota: lockout + daily budget (shared across PM2 workers) ─
// Google's Basic Access cap ("Number of operations for basic access") is enforced on
// the Keyword Planner endpoints; account reads/mutates keep working while it is spent.
const isPlannerPath = (path: string) => /:generateKeyword/.test(path)

// The Mongo row is the source of truth; each worker mirrors it for at most 60s, so
// a lock set OR cleared by one worker reaches the others within a minute.
let blockedUntil = 0
let blockCheckedAt = 0
let lastProbeAt = 0
const QUOTA_KEY = '__quota__'
/** While locked, let one real request through this often to see if Google recovered. */
const QUOTA_PROBE_MS = 15 * 60_000

interface QuotaLock { until: number; reason?: string | null; probedAt?: number }

async function readQuotaLock(): Promise<QuotaLock | null> {
  await connectDB()
  const doc = await GoogleAdsCache.findOne({ key: QUOTA_KEY }).lean<{ data?: QuotaLock }>()
  return doc?.data ?? null
}

async function quotaBlockedUntil(): Promise<number> {
  const now = Date.now()
  if (now - blockCheckedAt > 60_000) {
    blockCheckedAt = now
    try {
      const lock = await readQuotaLock()
      blockedUntil = Number(lock?.until ?? 0)
      lastProbeAt = Math.max(lastProbeAt, Number(lock?.probedAt ?? 0))
    } catch { /* DB blip: rely on the in-process value */ }
  }
  return blockedUntil > now ? blockedUntil : 0
}

function setQuotaBlock(until: number, reason: string | null) {
  if (until <= blockedUntil) return
  blockedUntil = until
  lastProbeAt = Date.now()
  console.warn(`[GoogleAds] quota 429 (${reason ?? 'no reason given'}) - Google calls paused until ${new Date(until).toISOString()}, re-checking every ${QUOTA_PROBE_MS / 60_000} min`)
  connectDB()
    .then(() => GoogleAdsCache.updateOne({ key: QUOTA_KEY }, { $set: { data: { until, reason, probedAt: Date.now() }, fetchedAt: new Date() } }, { upsert: true }))
    .catch(() => {})
}

/** Lift the lockout app-wide (a probe succeeded, or an admin re-check did). */
export async function clearQuotaBlock(): Promise<void> {
  if (blockedUntil > Date.now()) console.warn('[GoogleAds] quota re-check succeeded - Google calls resumed')
  blockedUntil = 0
  blockCheckedAt = Date.now()
  try {
    await connectDB()
    await GoogleAdsCache.deleteOne({ key: QUOTA_KEY })
  } catch { /* the next successful probe retries this */ }
}

/**
 * While locked, returns true for at most one caller per QUOTA_PROBE_MS (across workers,
 * via the shared row) so a real request can test whether Google has recovered.
 */
async function claimQuotaProbe(): Promise<boolean> {
  const now = Date.now()
  if (now - lastProbeAt < QUOTA_PROBE_MS) return false
  lastProbeAt = now
  try {
    await connectDB()
    // Atomic claim: only the worker that moves probedAt forward gets to probe.
    const r = await GoogleAdsCache.updateOne(
      { key: QUOTA_KEY, $or: [{ 'data.probedAt': { $exists: false } }, { 'data.probedAt': { $lt: now - QUOTA_PROBE_MS } }] },
      { $set: { 'data.probedAt': now } },
    )
    return r.modifiedCount === 1
  } catch { return true }
}

// Planner op counter (display only, never enforced): hourly buckets
// (`__ops__|YYYY-MM-DDTHH`) so every worker sees the same rolling 24h total.
const OPS_PREFIX = '__ops__|'
const hourKey = (t: number) => OPS_PREFIX + new Date(t).toISOString().slice(0, 13)
const opsMirror = { total: 0, at: 0 }
let opsSinceMirror = 0

async function plannerOpsLast24h(): Promise<number> {
  const now = Date.now()
  if (now - opsMirror.at > 60_000) {
    opsMirror.at = now
    try {
      await connectDB()
      const keys = Array.from({ length: 24 }, (_, i) => hourKey(now - i * 3600_000))
      const docs = await GoogleAdsCache.find({ key: { $in: keys } }).lean<{ data?: { n?: number } | null }[]>()
      opsMirror.total = docs.reduce((sum, d) => sum + Number(d.data?.n ?? 0), 0)
      opsSinceMirror = 0
    } catch { /* DB blip: keep the last mirror */ }
  }
  return opsMirror.total + opsSinceMirror
}

function countPlannerOp() {
  opsSinceMirror++
  // Raw collection: the model's `data: null` default would clash with $inc on data.n.
  connectDB()
    .then(() => GoogleAdsCache.collection.updateOne(
      { key: hourKey(Date.now()) },
      { $inc: { 'data.n': 1 }, $set: { fetchedAt: new Date() } },
      { upsert: true },
    ))
    .catch(() => {})
}

/** Current Google Ads availability, for the admin health view and UI notes. */
export async function googleAdsStatus(): Promise<{
  configured: boolean; quotaBlocked: boolean; retryAt: string | null; reason: string | null; nextCheckAt: string | null
  opsLast24h: number
}> {
  const opsLast24h = isGoogleAdsConfigured() ? await plannerOpsLast24h().catch(() => 0) : 0
  const usage = { opsLast24h }
  const none = { quotaBlocked: false, retryAt: null, reason: null, nextCheckAt: null, ...usage }
  if (!isGoogleAdsConfigured()) return { configured: false, ...none }
  const until = await quotaBlockedUntil()
  if (!until) return { configured: true, ...none }
  const lock = await readQuotaLock().catch(() => null)
  const probedAt = Math.max(lastProbeAt, Number(lock?.probedAt ?? 0))
  return {
    configured: true, quotaBlocked: true, retryAt: new Date(until).toISOString(),
    reason: lock?.reason ?? null,
    nextCheckAt: new Date(Math.min(until, probedAt + QUOTA_PROBE_MS)).toISOString(),
    ...usage,
  }
}

/**
 * Admin "Re-check now": ONE Keyword Planner call (the capped endpoint; an account read
 * would succeed even while Planner is exhausted). Clears the lock on success; on
 * another quota 429 the lock stays, with Google's latest reason.
 */
export async function recheckGoogleAdsQuota(): Promise<{ ok: boolean; message: string }> {
  if (!isGoogleAdsConfigured()) return { ok: false, message: 'Google Ads is not configured.' }
  try {
    await adsApiCall({
      token: await getAccessToken(),
      path: `customers/${digits(process.env.GOOGLE_ADS_CUSTOMER_ID)}:generateKeywordHistoricalMetrics`,
      body: { keywords: ['etsy'], geoTargetConstants: ['geoTargetConstants/2840'], keywordPlanNetwork: 'GOOGLE_SEARCH', language: LANG_EN },
      loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    }, { probe: true })
    await clearQuotaBlock()
    return { ok: true, message: 'Keyword Planner answered normally. Google data is resumed.' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Google Ads re-check failed' }
  }
}

// ─── Access token (module-cached ~55 min) ─────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token
  // Coalesce concurrent refreshes into ONE token request.
  return singleFlight('google-ads-token', async () => {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
        grant_type:    'refresh_token',
      }).toString(),
      cache: 'no-store',
    })
    if (!res.ok) throw new GoogleAdsError(`Google OAuth token error ${res.status}: ${await res.text().catch(() => '')}`, 'auth')
    const j = await res.json() as { access_token: string; expires_in: number }
    cachedToken = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }
    return j.access_token
  })
}

// ─── Quota-aware Google Ads requests ──────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function parseRetrySeconds(body: string): { scope: string | null; seconds: number | null; rateName: string | null } {
  try {
    const j = JSON.parse(body)
    const err = j?.error?.details?.[0]?.errors?.[0]
    const scope = err?.details?.quotaErrorDetails?.rateScope ?? null
    const rateName = err?.details?.quotaErrorDetails?.rateName ?? err?.message ?? null
    const delay = String(err?.details?.quotaErrorDetails?.retryDelay ?? '')
    const m = delay.match(/(\d+(?:\.\d+)?)s/) ?? String(err?.message ?? '').match(/Retry in (\d+) seconds/)
    return { scope, seconds: m ? Number(m[1]) : null, rateName: rateName ? String(rateName).slice(0, 200) : null }
  } catch { return { scope: null, seconds: null, rateName: null } }
}

// Plain-language next steps for Google Ads errors people actually hit.
const ADS_ERROR_HINTS: { test: RegExp; hint: string }[] = [
  { test: /Conversion tracking is not enabled/i, hint: 'Maximize conversions, Target CPA and Target ROAS need conversion tracking in this Google Ads account. Set up conversion tracking first, or choose Manual CPC.' },
  { test: /not yet enabled or has been deactivated/i, hint: 'Finish setting up this Google Ads account (or pick another account), then try again.' },
  { test: /billing/i, hint: 'Add billing details in Google Ads before ads can run.' },
  { test: /policy/i, hint: 'Edit the ad text so it follows Google Ads policies.' },
]

/** Turn a Google Ads API error body into a sentence a person can act on. */
/**
 * Google's error enums from a GoogleAdsFailure body, as `group.CODE` strings.
 * Each entry of `errors[]` carries `errorCode: { <group>: <ENUM> }`.
 */
export function googleAdsErrorCodes(text: string): string[] {
  try {
    const errs = JSON.parse(text)?.error?.details?.[0]?.errors
    if (!Array.isArray(errs)) return []
    const out: string[] = []
    for (const e of errs) {
      const code = (e as { errorCode?: Record<string, unknown> })?.errorCode
      if (!code || typeof code !== 'object') continue
      for (const [group, value] of Object.entries(code)) {
        if (typeof value === 'string') out.push(`${group}.${value}`)
      }
    }
    return [...new Set(out)]
  } catch { return [] }
}

export function googleAdsErrorMessage(text: string): string {
  try {
    const j = JSON.parse(text)
    type AdsErr = { message?: string; errorCode?: Record<string, string>; location?: { fieldPathElements?: { fieldName?: string }[] } }
    let errs: AdsErr[] = j?.error?.details?.[0]?.errors
    if (Array.isArray(errs) && errs.length) {
      // In an atomic mutate, one real failure makes every operation that referenced the
      // failed resource report "Resource was not found". Show only the root cause.
      const root = errs.filter(e => !/Resource was not found/i.test(e.message ?? ''))
      if (root.length) errs = root
      const seen = new Set<string>()
      const parts: string[] = []
      for (const e of errs.slice(0, 3)) {
        const msg = String(e.message ?? '').trim()
        if (!msg || seen.has(msg)) continue
        seen.add(msg)
        const hint = ADS_ERROR_HINTS.find(h => h.test.test(msg))?.hint
        // Generic messages ("The field's value is invalid") are useless without the field.
        const field = (e.location?.fieldPathElements ?? []).map(f => f.fieldName).filter(Boolean).pop()
        const withField = field && !/Conversion tracking|not yet enabled/i.test(msg) ? `${msg} (${field.replace(/_/g, ' ')})` : msg
        parts.push(hint ? `${withField} ${hint}` : withField)
      }
      return parts.join(' ')
    }
    if (j?.error?.message) return String(j.error.message)
  } catch { /* not JSON */ }
  return text.slice(0, 300) || 'Google Ads request failed'
}

export interface AdsCallOptions {
  /** OAuth access token for whoever owns the account being called. */
  token: string
  /** Path after the version, e.g. "customers/1234567890/googleAds:search". */
  path: string
  method?: 'GET' | 'POST'
  body?: unknown
  /** Manager (MCC) id when the customer is reached through a manager. */
  loginCustomerId?: string | null
}

/**
 * One quota-aware Google Ads API call. Every call made by the app (the shared
 * Keyword Planner lookups AND users' own connected accounts) goes through here.
 * The Planner lockout only gates Planner calls: users' own account management
 * keeps working while the Planner cap is spent.
 */
export async function adsApiCall<T>(o: AdsCallOptions, opts: { probe?: boolean } = {}): Promise<T> {
  const planner = isPlannerPath(o.path)
  // While locked, one Planner request per re-check window is let through to test recovery.
  const until = planner ? await quotaBlockedUntil() : 0
  const probing = !!until && (opts.probe || await claimQuotaProbe())
  if (until && !probing) throw new GoogleAdsError('Google Ads daily quota exhausted', 'quota', until)

  const headers: Record<string, string> = {
    'Authorization':   `Bearer ${o.token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type':    'application/json',
  }
  const loginId = digits(o.loginCustomerId ?? '')
  if (loginId) headers['login-customer-id'] = loginId

  for (let attempt = 0; attempt < 2; attempt++) {
    if (planner && !probing && blockedUntil > Date.now()) throw new GoogleAdsError('Google Ads daily quota exhausted', 'quota', blockedUntil)
    recordGoogleCall()
    if (planner) countPlannerOp()
    let res: Response
    try {
      res = await fetch(`https://googleads.googleapis.com/${V}/${o.path}`, {
        method: o.method ?? 'POST', headers,
        ...(o.method === 'GET' ? {} : { body: JSON.stringify(o.body ?? {}) }),
        cache: 'no-store',
        // A hung call used to hold the shared Planner queue indefinitely.
        signal: AbortSignal.timeout(planner ? REQUEST_TIMEOUT_MS : 30_000),
      })
    } catch (e) {
      const timedOut = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError'
      if (attempt === 0 && !timedOut) { await sleep(500); continue }   // network blip: one quick retry
      throw new GoogleAdsError(timedOut ? 'Google took too long to answer. Try again in a moment.' : 'Could not reach Google. Try again in a moment.', 'rate')
    }
    if (res.ok) {
      if (probing) void clearQuotaBlock()
      const t = await res.text()
      return (t ? JSON.parse(t) : {}) as T
    }

    const text = await res.text().catch(() => '')
    if (res.status === 429) {
      const { scope, seconds, rateName } = parseRetrySeconds(text)
      // Daily operation cap (or any long wait): lock Planner calls app-wide, never retry.
      if (scope === 'DEVELOPER' || (seconds != null && seconds > 60)) {
        // The project has Standard Access (unlimited daily operations, approved
        // 2026-09-28), so a "basic access" cap can only come from a Google server
        // that has not picked up the upgrade yet. Pause briefly instead of for
        // Google's full retry window, so one stale server can't blank Google data
        // for an hour.
        const staleBasic = /basic access/i.test(rateName ?? '')
        const lockUntil = Date.now() + (staleBasic ? 120 : (seconds ?? 3600)) * 1000
        if (planner) setQuotaBlock(lockUntil, [scope, rateName].filter(Boolean).join(': ') || null)
        throw new GoogleAdsError('Google Ads daily quota exhausted', 'quota', lockUntil)
      }
      // Short per-second limit: wait what Google asks (capped), retry once. Planner
      // calls run inside the shared queue, so they wait at most ~2 s (everyone behind
      // them waits too); the scheduler then widens its gap for the following calls.
      if (attempt === 0) { await sleep(Math.min(planner ? 2 : 8, seconds ?? (planner ? 1 : 2)) * 1000 + 200); continue }
      throw new GoogleAdsError(`Google Ads is rate limiting requests. Try again in a moment.`, 'rate')
    }
    if (res.status >= 500 && attempt === 0) { await sleep(800); continue }
    if (res.status === 404 && !text.includes('"errors"')) {
      throw new GoogleAdsError(
        `Google Ads API ${V} returned 404 - that version has almost certainly been sunset. ` +
        `Set GOOGLE_ADS_API_VERSION to a current one (see https://developers.google.com/google-ads/api/docs/sunset-dates). Body: ${text.slice(0, 200)}`, 'http')
    }
    throw new GoogleAdsError(
      googleAdsErrorMessage(text),
      res.status === 401 || res.status === 403 ? 'auth' : 'http',
      null,
      googleAdsErrorCodes(text),
    )
  }
  throw new GoogleAdsError('Google Ads request failed', 'http')
}

// ─── Shared Keyword Planner scheduler (per process) ───────────────────────────
// All of the app's own Planner calls go through ONE lane-ordered queue per worker.
//
// It used to be a plain FIFO: one call at a time, a fixed 250 ms gap, and no
// timeout. At peak (~2,700 searches/hour, each new keyword needing its own volume
// + related batch + 7 per-country lookups) work arrived faster than it drained,
// so a user's keyword volume waited behind other people's country charts for
// MINUTES, and past Cloudflare's 100 s the page errored. A per-second 429 also
// slept up to 8 s INSIDE the queue, stalling everyone behind it.
//
// Now:
//   • priority lanes  - 'high' (the keyword being searched) always goes first,
//                       'normal' (related batches), 'low' (country breakdown, ideas).
//   • waiting limit   - a call that queued longer than its lane allows is dropped
//                       with a 'rate' error; callers already fall back to stored
//                       data and say Google is busy, and the client re-asks shortly.
//   • request timeout - a hung Google call can no longer freeze the queue.
//   • adaptive gap    - doubles on a per-second 429, eases back on success, so the
//                       4 workers stop tripping Google's per-second limit together.
export type GooglePriority = 'high' | 'normal' | 'low'
const LANE_ORDER: GooglePriority[] = ['high', 'normal', 'low']
const MAX_WAIT_MS: Record<GooglePriority, number> = { high: 25_000, normal: 30_000, low: 30_000 }
const REQUEST_TIMEOUT_MS = 15_000

// ── Planner accounts ──────────────────────────────────────────────────────────
// Google allows Keyword Planner ONE request per second PER ACCOUNT (customer id),
// whatever the access level (developers.google.com/google-ads/api/docs/best-practices/quotas).
// One account therefore caps the whole site at ~86k requests a day; on 2026-10-02
// we were asking ~110k, so every Google number queued for minutes. Extra client
// accounts under the same manager each add one request per second:
//   GOOGLE_ADS_PLANNER_CUSTOMER_IDS=1111111111,2222222222,...
// (falls back to GOOGLE_ADS_CUSTOMER_ID). Every worker shares every account, so
// each worker spaces its own requests per account by WORKERS x 1.1 s.
const PLANNER_CIDS = [...new Set(
  (process.env.GOOGLE_ADS_PLANNER_CUSTOMER_IDS || process.env.GOOGLE_ADS_CUSTOMER_ID || '')
    .split(/[\s,]+/).map(x => digits(x)).filter(Boolean),
)]
const CID_INTERVAL_MS = Math.ceil(1100 * workerCount())

interface PlannerAccount { cid: string; nextAt: number; slowUntil: number; badUntil: number; sent: number; errors: number }
interface QueuedCall {
  run: (cid: string) => Promise<unknown>
  resolve: (v: unknown) => void
  reject: (e: unknown) => void
  enqueuedAt: number
  priority: GooglePriority
  /** Batched calls: build the request at send time; false = nothing left to send (no Google call). */
  prepare?: () => boolean
  /** Called if the job waited past its lane limit and was dropped. */
  onExpire?: () => void
}
interface PlannerState {
  accounts: PlannerAccount[]
  lanes: Record<GooglePriority, QueuedCall[]>
  dispatching: boolean
  dispatched: number
  inFlight: number
  waits: number[]   // recent queue waits (ms), for the admin readout
}
// Pinned on globalThis: Next bundles this module into many route chunks, and a
// module-level queue gave each chunk its OWN queue and pacing, so together they
// sent several times the per-account limit and tripped Google's 429s.
const pg = globalThis as typeof globalThis & { __rkPlanner?: PlannerState }
const planner: PlannerState = pg.__rkPlanner ??= {
  accounts: PLANNER_CIDS.map(cid => ({ cid, nextAt: 0, slowUntil: 0, badUntil: 0, sent: 0, errors: 0 })),
  lanes: { high: [], normal: [], low: [] },
  dispatching: false,
  dispatched: 0,
  inFlight: 0,
  waits: [],
}

function nextJob(): QueuedCall | undefined {
  const now = Date.now()
  // Drop anything that waited past its lane's limit: callers fall back to stored
  // data and say Google is busy, instead of hanging until Cloudflare's 100 s.
  for (const l of LANE_ORDER) {
    const lane = planner.lanes[l]
    while (lane.length && now - lane[0].enqueuedAt > MAX_WAIT_MS[l]) {
      const j = lane.shift()!
      j.onExpire?.()
      j.reject(new GoogleAdsError('Google is busy right now. Try again in a moment.', 'rate'))
    }
  }
  // Every 4th request goes to the lowest waiting lane, so country charts and
  // keyword ideas always make progress at peak instead of starving forever.
  if (planner.dispatched % 4 === 3) {
    const low = [...LANE_ORDER].reverse().find(l => planner.lanes[l].length)
    if (low) return planner.lanes[low].shift()
  }
  const lane = LANE_ORDER.find(l => planner.lanes[l].length)
  return lane ? planner.lanes[lane].shift() : undefined
}

async function dispatch(): Promise<void> {
  if (planner.dispatching) return
  planner.dispatching = true
  try {
    for (;;) {
      if (!LANE_ORDER.some(l => planner.lanes[l].length)) break
      const now = Date.now()
      const usable = planner.accounts.filter(a => a.badUntil <= now)
      const pool = usable.length ? usable : planner.accounts
      if (!pool.length) {
        // Misconfigured (no customer id): fail everything rather than hang.
        for (const l of LANE_ORDER) for (const j of planner.lanes[l].splice(0)) j.reject(new GoogleAdsError('Google Ads customer id is not set', 'http'))
        break
      }
      const acct = pool.reduce((a, b) => (b.nextAt < a.nextAt ? b : a))
      if (acct.nextAt > now) { await sleep(Math.min(acct.nextAt - now, 1000)); continue }
      const job = nextJob()
      if (!job) continue
      // A batch another slot already sent: nothing to ask Google, keep the slot.
      if (job.prepare && !job.prepare()) { job.resolve(null); continue }
      planner.dispatched++
      acct.sent++
      // After a per-second 429 this account is paced at half speed for a minute.
      acct.nextAt = now + CID_INTERVAL_MS * (acct.slowUntil > now ? 2 : 1)
      planner.waits.push(now - job.enqueuedAt)
      if (planner.waits.length > 200) planner.waits.splice(0, planner.waits.length - 200)
      planner.inFlight++
      // Not awaited: requests to different accounts (and the next slot on this one)
      // go out while this one is still being answered (~1-2 s each).
      void job.run(acct.cid).then(
        v => job.resolve(v),
        e => {
          acct.errors++
          if (e instanceof GoogleAdsError && e.kind === 'rate') acct.slowUntil = Date.now() + 60_000
          // An account Google refuses (not enabled, no access) sits out for 10 minutes.
          if (e instanceof GoogleAdsError && e.kind === 'auth' && planner.accounts.length > 1) {
            acct.badUntil = Date.now() + 600_000
            console.warn(`[GoogleAds] planner account ${acct.cid} refused: ${e.message.slice(0, 160)}`)
          }
          job.reject(e)
        },
      ).finally(() => { planner.inFlight-- })
    }
  } finally {
    planner.dispatching = false
  }
}

/** Queue one of the app's own Planner calls in its priority lane. */
async function adsRequest<T>(path: string, body: unknown, priority: GooglePriority = 'normal'): Promise<T> {
  const run = async (cid: string): Promise<T> => adsApiCall<T>({
    token: await getAccessToken(),
    path: `customers/${cid}${path}`,
    body,
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  })
  return new Promise<T>((resolve, reject) => {
    planner.lanes[priority].push({ run: run as (cid: string) => Promise<unknown>, resolve: resolve as (v: unknown) => void, reject, enqueuedAt: Date.now(), priority })
    void dispatch()
  })
}

/** Queue a batched Planner call whose request is built only when its slot comes up. */
type PreparedBatch = { body: unknown; deliver: (j: { results?: unknown[] } | null, err?: unknown) => void }
function adsBatchRequest(path: string, take: () => PreparedBatch | null, onExpire: () => void, priority: GooglePriority): Promise<unknown> {
  let prepared: PreparedBatch | null = null
  return new Promise((resolve, reject) => {
    planner.lanes[priority].push({
      prepare: () => { prepared = take(); return !!prepared },
      run: async (cid: string) => {
        const p = prepared!
        try {
          const j = await adsApiCall<{ results?: unknown[] }>({
            token: await getAccessToken(),
            path: `customers/${cid}${path}`,
            body: p.body,
            loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
          })
          p.deliver(j)
          return j
        } catch (e) {
          p.deliver(null, e)
          throw e
        }
      },
      onExpire,
      resolve, reject, enqueuedAt: Date.now(), priority,
    })
    void dispatch()
  })
}

/** Queue depth per lane plus per-account pacing (diagnostics / admin health). */
export function googleQueueDepth() {
  const w = [...planner.waits].sort((a, b) => a - b)
  return {
    high: planner.lanes.high.length,
    normal: planner.lanes.normal.length,
    low: planner.lanes.low.length,
    inFlight: planner.inFlight,
    accounts: planner.accounts.length,
    intervalMs: CID_INTERVAL_MS,
    waitP50Ms: w.length ? w[Math.floor(w.length / 2)] : 0,
    waitP90Ms: w.length ? w[Math.floor(w.length * 0.9)] : 0,
    perAccount: planner.accounts.map(a => ({ cid: `…${a.cid.slice(-4)}`, sent: a.sent, errors: a.errors, resting: a.badUntil > Date.now() })),
  }
}

// ─── Metrics types ────────────────────────────────────────────────────────────
export interface GoogleMetric {
  keyword: string
  searches: number
  /** Google's own advertiser-competition band. Distinct from Etsy listing competition. */
  competition: string
  /** 0–100 competition index. null when Google doesn't return one (low-volume terms). */
  competitionIndex: number | null
  /** Top-of-page bid range, in the Ads ACCOUNT's currency (see googleAccountCurrency). null when absent. */
  cpcLow: number | null
  cpcHigh: number | null
  monthly: number[]
}

// Google returns bids in micros of the account currency: 1 unit = 1_000_000 micros.
const microsToCurrency = (v?: string | number | null): number | null =>
  v == null ? null : Number(v) / 1_000_000

// Cached row: `m` is null when Google has no data for the keyword (so we don't re-ask daily).
interface StoredMetric { m: GoogleMetric | null; at: number }
const metricKey = (geoId: string, kw: string) => `m|${geoId}|${kw}`
const normKws = (keywords: string[]) => [...new Set(keywords.map(k => k.toLowerCase().trim()).filter(Boolean))]
const isFresh = (s: StoredMetric) => Date.now() - s.at < (s.m ? FRESH_MS : EMPTY_FRESH_MS)

async function readStored(keys: string[]): Promise<Map<string, StoredMetric>> {
  const out = new Map<string, StoredMetric>()
  const need: string[] = []
  for (const k of keys) {
    const hit = memCache.get<StoredMetric>(`gads:${k}`)
    if (hit) out.set(k, hit); else need.push(k)
  }
  if (!need.length) return out
  try {
    await connectDB()
    const docs = await GoogleAdsCache.find({ key: { $in: need } }).lean<{ key: string; data: GoogleMetric | null; fetchedAt: Date }[]>()
    for (const d of docs) {
      const s: StoredMetric = { m: d.data ?? null, at: new Date(d.fetchedAt).getTime() }
      out.set(d.key, s)
      memCache.set(`gads:${d.key}`, s, 6 * 3600)
    }
  } catch (e) { console.error('[GoogleAds] cache read failed:', e) }
  return out
}

function writeStored(rows: { key: string; m: GoogleMetric | null }[]) {
  if (!rows.length) return
  const at = new Date()
  for (const r of rows) memCache.set(`gads:${r.key}`, { m: r.m, at: at.getTime() } satisfies StoredMetric, 6 * 3600)
  connectDB()
    .then(() => GoogleAdsCache.bulkWrite(rows.map(r => ({
      updateOne: { filter: { key: r.key }, update: { $set: { data: r.m, fetchedAt: at } }, upsert: true },
    })), { ordered: false }))
    .catch(e => console.error('[GoogleAds] cache write failed:', e))
}

function noteFailure(meta: GoogleMetricsMeta | undefined, e: unknown) {
  if (!meta) return
  meta.failed = true
  if (e instanceof GoogleAdsError && e.kind === 'quota') {
    meta.quota = true
    meta.retryAt = e.retryAt ? new Date(e.retryAt).toISOString() : null
  }
}

// ── Cross-user batching ───────────────────────────────────────────────────────
// Keyword Planner answers up to 10,000 keywords in ONE request, and requests are
// what Google rate-limits (1/s per account). So every lookup for the same country
// (or the same Global set) that is waiting at the same moment, from any user or
// route, rides in one request instead of queueing for its own. Under load this is
// the difference between minutes and seconds: N waiting users cost one request.
const BATCH_MAX_KEYWORDS = 5000
interface BatchWaiter { kws: string[]; got: Map<string, GoogleMetric>; resolve: (m: Map<string, GoogleMetric>) => void; reject: (e: unknown) => void; done: boolean }
interface HistBatch { geoIds: string[]; waiters: BatchWaiter[]; lanes: Set<GooglePriority> }
const bg = globalThis as typeof globalThis & { __rkHistBatches?: Map<string, HistBatch> }
const histBatches: Map<string, HistBatch> = bg.__rkHistBatches ??= new Map()

function parseHistorical(results: unknown[] | undefined): Map<string, GoogleMetric> {
  const got = new Map<string, GoogleMetric>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (results ?? []) as any[]) {
    const m = r.keywordMetrics
    if (!m) continue
    const monthly = (m.monthlySearchVolumes ?? []).map((v: { monthlySearches?: string }) => Number(v.monthlySearches ?? 0))
    got.set(String(r.text).toLowerCase(), {
      keyword:     String(r.text),
      searches:    Number(m.avgMonthlySearches ?? 0),
      competition: String(m.competition ?? 'UNSPECIFIED'),
      competitionIndex: m.competitionIndex != null ? Number(m.competitionIndex) : null,
      cpcLow:      microsToCurrency(m.lowTopOfPageBidMicros),
      cpcHigh:     microsToCurrency(m.highTopOfPageBidMicros),
      monthly,
    })
  }
  return got
}

function batchedHistorical(kws: string[], geoIds: string[], cacheGeo: string, priority: GooglePriority): Promise<Map<string, GoogleMetric>> {
  return new Promise((resolve, reject) => {
    const waiter: BatchWaiter = { kws: [...kws], got: new Map(), resolve, reject, done: false }
    // Never wait past the lane's limit, even if the batch is still queued.
    const timer = setTimeout(() => {
      if (waiter.done) return
      waiter.done = true
      reject(new GoogleAdsError('Google is busy right now. Try again in a moment.', 'rate'))
    }, MAX_WAIT_MS[priority] + 5_000)
    waiter.resolve = m => { clearTimeout(timer); resolve(m) }
    waiter.reject = e => { clearTimeout(timer); reject(e) }
    joinBatch(cacheGeo, geoIds, waiter, priority)
  })
}

function joinBatch(cacheGeo: string, geoIds: string[], waiter: BatchWaiter, priority: GooglePriority) {
  let b = histBatches.get(cacheGeo)
  if (!b) { b = { geoIds, waiters: [], lanes: new Set() }; histBatches.set(cacheGeo, b) }
  b.waiters.push(waiter)
  if (b.lanes.has(priority)) return
  b.lanes.add(priority)
  const batch = b
  // One queued request per lane in use; whichever runs first takes the whole batch,
  // the other then finds it empty and resolves without calling Google.
  adsBatchRequest(':generateKeywordHistoricalMetrics', () => takeBatch(cacheGeo, batch), () => {
    // Dropped from the queue: let the next lookup start a fresh batch (the waiters
    // here time out on their own and fall back to stored data).
    batch.lanes.delete(priority)
    if (!batch.lanes.size && histBatches.get(cacheGeo) === batch) histBatches.delete(cacheGeo)
  }, priority).catch(() => { /* errors reach the waiters through deliver() */ })
}

/** Called when a queued slot is about to send: claim every waiting keyword for this geo. */
function takeBatch(cacheGeo: string, batch: HistBatch): PreparedBatch | null {
  if (histBatches.get(cacheGeo) !== batch) return null   // already sent by another lane's slot
  histBatches.delete(cacheGeo)
  const live = batch.waiters.filter(w => !w.done)
  if (!live.length) return null
  const send: string[] = []
  const sendSet = new Set<string>()
  for (const w of live) for (const k of w.kws) {
    if (sendSet.has(k) || sendSet.size >= BATCH_MAX_KEYWORDS) continue
    sendSet.add(k); send.push(k)
  }
  return {
    body: {
      keywords: send,
      geoTargetConstants: batch.geoIds.map(id => `geoTargetConstants/${id}`),
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      language: LANG_EN,
    },
    deliver: (j, err) => {
      if (err || !j) { for (const w of live) if (!w.done) { w.done = true; w.reject(err ?? new GoogleAdsError('Google Ads request failed', 'http')) } return }
      const got = parseHistorical(j.results)
      writeStored(send.map(kw => ({ key: metricKey(cacheGeo, kw), m: got.get(kw) ?? null })))
      for (const w of live) {
        if (w.done) continue
        const left: string[] = []
        for (const k of w.kws) {
          if (sendSet.has(k)) { const m = got.get(k); if (m) w.got.set(k, m) }
          else left.push(k)
        }
        // A batch over the size cap: the rest of this waiter's keywords go in the next one.
        if (left.length) { w.kws = left; joinBatch(cacheGeo, batch.geoIds, w, 'normal'); continue }
        w.done = true
        w.resolve(w.got)
      }
    },
  }
}

/** Historical metrics for keywords over a set of geo targets (one country, or all tracked
 *  countries combined for Global), stored under `cacheGeo`: cache first, then ONE batched
 *  request for only the misses. On failure, stale stored rows are used. Never throws. */
async function fetchMetrics(keywords: string[], geoIds: string[], cacheGeo: string, meta: GoogleMetricsMeta | undefined, priority?: GooglePriority): Promise<Map<string, GoogleMetric>> {
  const out = new Map<string, GoogleMetric>()
  const kws = normKws(keywords).slice(0, 1000)
  if (!kws.length) return out

  const stored = await readStored(kws.map(k => metricKey(cacheGeo, k)))
  const misses: string[] = []
  for (const kw of kws) {
    const s = stored.get(metricKey(cacheGeo, kw))
    if (s && isFresh(s)) { if (s.m) out.set(kw, s.m) }
    else misses.push(kw)
  }
  if (!misses.length) return out

  try {
    // Joins whatever other users are asking for in this country right now: one
    // Google request answers all of them (see batchedHistorical).
    const fetched = await batchedHistorical(misses, geoIds, cacheGeo, priority ?? (misses.length <= 2 ? 'high' : 'normal'))
    for (const [k, v] of fetched) out.set(k, v)
  } catch (e) {
    // The lockout is logged once when it trips; don't repeat it for every country/keyword.
    if (!(e instanceof GoogleAdsError && e.kind === 'quota')) console.error(`[GoogleAds] metrics (geo ${cacheGeo}) failed:`, e instanceof Error ? e.message : e)
    noteFailure(meta, e)
    // Stale beats blank: serve the last stored answer for anything Google couldn't refresh.
    for (const kw of misses) {
      const s = stored.get(metricKey(cacheGeo, kw))
      if (s?.m) { out.set(kw, s.m); if (meta) meta.stale = true }
    }
  }
  return out
}

/** Historical metrics in ONE country. */
function metricsForGeo(keywords: string[], geoId: string, meta?: GoogleMetricsMeta, priority?: GooglePriority): Promise<Map<string, GoogleMetric>> {
  return fetchMetrics(keywords, [geoId], geoId, meta, priority)
}

/** Add up per-country answers for one keyword (volume + monthly summed, bids averaged). */
function sumMetrics(keyword: string, rows: GoogleMetric[]): GoogleMetric | null {
  if (!rows.length) return null
  const BAND_RANK: Record<string, number> = { UNSPECIFIED: 0, UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 }
  let searches = 0, compIdxSum = 0, compIdxCount = 0, cpcLowSum = 0, cpcLowCount = 0, cpcHighSum = 0, cpcHighCount = 0
  const monthly: number[] = []
  let bestBand = 'UNSPECIFIED'
  for (const g of rows) {
    searches += g.searches
    for (let i = 0; i < g.monthly.length; i++) monthly[i] = (monthly[i] ?? 0) + g.monthly[i]
    if (g.competitionIndex != null) { compIdxSum += g.competitionIndex; compIdxCount++ }
    if (g.cpcLow != null) { cpcLowSum += g.cpcLow; cpcLowCount++ }
    if (g.cpcHigh != null) { cpcHighSum += g.cpcHigh; cpcHighCount++ }
    if ((BAND_RANK[g.competition] ?? 0) > (BAND_RANK[bestBand] ?? 0)) bestBand = g.competition
  }
  return {
    keyword, searches, competition: bestBand,
    competitionIndex: compIdxCount ? Math.round(compIdxSum / compIdxCount) : null,
    cpcLow: cpcLowCount ? parseFloat((cpcLowSum / cpcLowCount).toFixed(2)) : null,
    cpcHigh: cpcHighCount ? parseFloat((cpcHighSum / cpcHighCount).toFixed(2)) : null,
    monthly,
  }
}

/** Cache bucket for the combined all-tracked-countries answer. */
const GLOBAL_CACHE_GEO = 'GLO7'
const TRACKED_GEO_IDS = Object.values(GEO_TARGETS).map(g => g.id)

/**
 * Global = volume across all tracked countries. If every country already has a fresh
 * stored row (the country chart wrote them), their sum is free. Otherwise ONE request
 * with all tracked countries as targets (Google combines them), instead of 7
 * per-country requests. Omitting geoTargetConstants returns an EMPTY result for this
 * endpoint in practice, which is why Global is "all tracked countries".
 */
async function metricsGlobal(keywords: string[], meta?: GoogleMetricsMeta): Promise<Map<string, GoogleMetric>> {
  const out = new Map<string, GoogleMetric>()
  const kws = normKws(keywords).slice(0, 1000)
  if (!kws.length) return out

  // A stored combined answer wins, so a keyword's Global number doesn't flip between
  // the combined figure and the per-country sum as the country chart fills in rows.
  const combinedStored = await readStored(kws.map(kw => metricKey(GLOBAL_CACHE_GEO, kw)))
  const perGeo = await readStored(kws.flatMap(kw => TRACKED_GEO_IDS.map(id => metricKey(id, kw))))
  const need: string[] = []
  for (const kw of kws) {
    const c = combinedStored.get(metricKey(GLOBAL_CACHE_GEO, kw))
    if (c && isFresh(c)) { need.push(kw); continue }   // fetchMetrics serves it from cache at no cost
    const rows = TRACKED_GEO_IDS.map(id => perGeo.get(metricKey(id, kw)))
    if (rows.every(r => r && isFresh(r))) {
      const sum = sumMetrics(kw, rows.map(r => r!.m).filter((m): m is GoogleMetric => !!m))
      if (sum) out.set(kw, sum)
    } else need.push(kw)
  }
  if (!need.length) return out

  const local: GoogleMetricsMeta = {}
  const combined = await fetchMetrics(need, TRACKED_GEO_IDS, GLOBAL_CACHE_GEO, local)
  if (meta) Object.assign(meta, { ...local, failed: meta.failed || local.failed, quota: meta.quota || local.quota, stale: meta.stale || local.stale })
  for (const kw of need) {
    const m = combined.get(kw)
    if (m) { out.set(kw, m); continue }
    // Only when Google could not answer: fall back to whatever per-country rows exist.
    if (!local.failed) continue
    const partial = TRACKED_GEO_IDS.map(id => perGeo.get(metricKey(id, kw))?.m).filter((x): x is GoogleMetric => !!x)
    const sum = sumMetrics(kw, partial)
    if (sum) { out.set(kw, sum); if (meta) meta.stale = true }
  }
  return out
}

/** Google monthly search volume for many keywords (default geo US). Safe: returns
 *  an empty map (never throws) when Google Ads isn't configured or the call fails;
 *  pass `meta` to learn whether (and why) Google couldn't answer. */
export async function googleKeywordMetrics(
  keywords: string[],
  geoIso = 'US',
  meta?: GoogleMetricsMeta,
): Promise<Map<string, GoogleMetric>> {
  if (!isGoogleAdsConfigured()) return new Map()
  const geo = normalizeGeo(geoIso)
  try {
    if (geo === 'GLO') return await metricsGlobal(keywords, meta)
    return await metricsForGeo(keywords, geoIdFor(geo) ?? '2840', meta)
  } catch (e) {
    console.error('[GoogleAds] keyword metrics failed:', e)
    noteFailure(meta, e)
    return new Map()
  }
}

/** Per-country search distribution for a single keyword, as CountryData[] (%). */
export async function googleCountryBreakdown(keyword: string, meta?: GoogleMetricsMeta): Promise<{ country: string; percentage: number; color: string }[]> {
  if (!isGoogleAdsConfigured()) return []
  const kw = keyword.toLowerCase().trim()
  // No Google volume worldwide means every country is zero too, and the chart would
  // come back empty anyway: answer that from the (usually already stored) Global
  // figure instead of spending 7 requests on it. Most long-tail Etsy keywords
  // land here.
  const gmeta: GoogleMetricsMeta = {}
  const global = await metricsGlobal([kw], gmeta)
  if (!gmeta.failed && !(global.get(kw)?.searches)) return []

  // All 7 countries are queued together: the scheduler spaces them per account and
  // folds each into whatever batch other users already have waiting for that
  // country, so they no longer wait for each other one by one.
  const answers = await Promise.all(Object.keys(GEO_TARGETS).map(async iso => {
    const local: GoogleMetricsMeta = {}
    // Background lane: the chart is secondary, so it never delays a keyword's own volume.
    const m = await metricsForGeo([kw], GEO_TARGETS[iso].id, local, 'low')
    return { iso, local, m }
  }))
  const results: { iso: string; searches: number }[] = []
  for (const { iso, local, m } of answers) {
    if (meta) Object.assign(meta, { failed: meta.failed || local.failed, quota: meta.quota || local.quota, stale: meta.stale || local.stale, retryAt: meta.retryAt ?? local.retryAt })
    // A country Google could not answer (and had no stored figure for) would make the
    // others' shares look bigger than they are. Never show a partial split as if it
    // were complete: return nothing and let the caller report "busy". Every country
    // that DID answer is already stored, so the next attempt only asks for the rest.
    if (local.failed && !m.has(kw)) return []
    results.push({ iso, searches: m.get(kw)?.searches ?? 0 })
  }
  const total = results.reduce((s, r) => s + r.searches, 0)
  if (!total) return []
  return results
    .filter(r => r.searches > 0)
    .sort((a, b) => b.searches - a.searches)
    .map(r => ({ country: GEO_TARGETS[r.iso].name, percentage: parseFloat(((r.searches / total) * 100).toFixed(1)), color: GEO_TARGETS[r.iso].color }))
}

/**
 * Searchers-by-Country for a keyword. Always the FULL breakdown across the tracked
 * countries (like eRank). For a specific country we flag its row (`selected`).
 */
export async function countriesForGeo(keyword: string, geo: string, meta?: GoogleMetricsMeta): Promise<{ country: string; percentage: number; color: string; selected?: boolean }[]> {
  const breakdown = await googleCountryBreakdown(keyword, meta)
  if (geo === 'GLO' || !breakdown.length) return breakdown
  const name = KEYWORD_GEOS[geo]?.name ?? GEO_TARGETS[geo]?.name ?? geo
  return breakdown.map(c => (c.country === name ? { ...c, selected: true } : c))
}

// ─── Account currency (stored; it never changes for an account) ───────────────
let cachedCurrency: string | null = null

export async function googleAccountCurrency(): Promise<string | null> {
  if (!isGoogleAdsConfigured()) return null
  if (cachedCurrency) return cachedCurrency
  return singleFlight('google-ads-currency', async () => {
    if (cachedCurrency) return cachedCurrency
    try {
      await connectDB()
      const doc = await GoogleAdsCache.findOne({ key: 'currency' }).lean<{ data?: string }>()
      if (doc?.data) { cachedCurrency = String(doc.data); return cachedCurrency }
    } catch { /* fall through to the API */ }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await adsRequest<any>('/googleAds:searchStream', { query: 'SELECT customer.currency_code FROM customer LIMIT 1' }, 'high')
      const code = (Array.isArray(j) ? j[0]?.results?.[0] : j?.results?.[0])?.customer?.currencyCode
      if (code) {
        cachedCurrency = String(code)
        connectDB().then(() => GoogleAdsCache.updateOne({ key: 'currency' }, { $set: { data: cachedCurrency, fetchedAt: new Date() } }, { upsert: true })).catch(() => {})
      }
      return cachedCurrency
    } catch (e) {
      console.error('[GoogleAds] currency lookup failed:', e instanceof Error ? e.message : e)
      return null
    }
  })
}

// ─── Keyword ideas: Google-suggested keywords for a seed, each with real metrics ─
// Genuine keyword DISCOVERY (generateKeywordIdeas). Stored per (seed, country) too,
// because the AI Title/Tag/Description tools ask for the same seed repeatedly.
export interface GoogleIdea {
  keyword: string
  searches: number
  competition: string          // LOW | MEDIUM | HIGH | UNSPECIFIED
  competitionIndex: number | null
  cpcLow: number | null
  cpcHigh: number | null
}

/** Up to `limit` Google keyword ideas for a seed phrase. Safe: [] when unconfigured or on error. */
export async function googleKeywordIdeas(seed: string, geoIso = 'US', limit = 40, meta?: GoogleMetricsMeta): Promise<GoogleIdea[]> {
  if (!isGoogleAdsConfigured()) return []
  const term = seed.toLowerCase().trim()
  if (!term) return []
  const geo = normalizeGeo(geoIso)
  const key = `i|${geo}|${term}`

  let stale: { ideas: GoogleIdea[]; at: number } | null = null
  const mem = memCache.get<{ ideas: GoogleIdea[]; at: number }>(`gads:${key}`)
  if (mem && Date.now() - mem.at < FRESH_MS) return mem.ideas.slice(0, limit)
  try {
    await connectDB()
    const doc = await GoogleAdsCache.findOne({ key }).lean<{ data?: GoogleIdea[]; fetchedAt: Date }>()
    if (doc?.data) {
      const hit = { ideas: doc.data, at: new Date(doc.fetchedAt).getTime() }
      // An empty stored answer is re-asked after a week; real ideas are reused for FRESH days.
      if (Date.now() - hit.at < (hit.ideas.length ? FRESH_MS : EMPTY_FRESH_MS)) {
        memCache.set(`gads:${key}`, hit, 6 * 3600)
        return hit.ideas.slice(0, limit)
      }
      stale = hit
    }
  } catch { /* fall through to the API */ }

  try {
    const ideas = await singleFlight(`gads-ideas:${key}`, async () => {
      const geoId = geoIdFor(geo)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await adsRequest<{ results?: any[] }>(':generateKeywordIdeas', {
        keywordSeed: { keywords: [term] },
        // null geo = Global: omit the target for worldwide ideas (works for this endpoint).
        ...(geoId ? { geoTargetConstants: [`geoTargetConstants/${geoId}`] } : {}),
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        language: LANG_EN,
        pageSize: 100,
      }, 'low')   // keyword ideas are supplementary: background lane
      const list: GoogleIdea[] = (j.results ?? [])
        .map(r => {
          const m = r.keywordIdeaMetrics ?? {}
          return {
            keyword:     String(r.text),
            searches:    Number(m.avgMonthlySearches ?? 0),
            competition: String(m.competition ?? 'UNSPECIFIED'),
            competitionIndex: m.competitionIndex != null ? Number(m.competitionIndex) : null,
            cpcLow:      microsToCurrency(m.lowTopOfPageBidMicros),
            cpcHigh:     microsToCurrency(m.highTopOfPageBidMicros),
          }
        })
        .filter(i => i.keyword)
      // Each idea carries full metrics for that keyword in this country: store them as
      // metrics rows too, so later volume lookups for these keywords cost nothing.
      if (geoId) {
        writeStored((j.results ?? []).filter(r => r?.text && r.keywordIdeaMetrics).map(r => {
          const m = r.keywordIdeaMetrics
          return {
            key: metricKey(geoId, String(r.text).toLowerCase().trim()),
            m: {
              keyword: String(r.text),
              searches: Number(m.avgMonthlySearches ?? 0),
              competition: String(m.competition ?? 'UNSPECIFIED'),
              competitionIndex: m.competitionIndex != null ? Number(m.competitionIndex) : null,
              cpcLow: microsToCurrency(m.lowTopOfPageBidMicros),
              cpcHigh: microsToCurrency(m.highTopOfPageBidMicros),
              monthly: (m.monthlySearchVolumes ?? []).map((v: { monthlySearches?: string }) => Number(v.monthlySearches ?? 0)),
            },
          }
        }))
      }
      const at = new Date()
      memCache.set(`gads:${key}`, { ideas: list, at: at.getTime() }, 6 * 3600)
      connectDB().then(() => GoogleAdsCache.updateOne({ key }, { $set: { data: list, fetchedAt: at } }, { upsert: true })).catch(() => {})
      return list
    })
    return ideas.slice(0, limit)
  } catch (e) {
    if (!(e instanceof GoogleAdsError && e.kind === 'quota')) console.error('[GoogleAds] keyword ideas failed:', e instanceof Error ? e.message : e)
    noteFailure(meta, e)
    if (stale) { if (meta) meta.stale = true; return stale.ideas.slice(0, limit) }
    return []
  }
}
