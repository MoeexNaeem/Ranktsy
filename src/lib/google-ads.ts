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
 *     (rateScope ACCOUNT) waits the delay Google asks for, once.
 *  4. When Google can't answer, the last stored numbers are served (stale beats blank),
 *     and callers get `meta.quota` / `meta.failed` so the UI can say WHY data is missing.
 *
 * Real fix for scale: apply for STANDARD access on the developer token (no daily
 * operation cap): Google Ads UI → Tools → API Center → "Apply for Standard Access".
 */
import { recordGoogleCall } from '@/lib/usage'
import { singleFlight } from '@/lib/concurrency'
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

class GoogleAdsError extends Error {
  constructor(message: string, readonly kind: 'quota' | 'rate' | 'auth' | 'http', readonly retryAt: number | null = null) {
    super(message)
  }
}

// ─── Daily-quota lockout (shared across PM2 workers via Mongo) ────────────────
let blockedUntil = 0
let blockCheckedAt = 0
const QUOTA_KEY = '__quota__'

async function quotaBlockedUntil(): Promise<number> {
  const now = Date.now()
  if (blockedUntil > now) return blockedUntil
  // Re-read the shared lock at most every 60s so other workers learn about it.
  if (now - blockCheckedAt > 60_000) {
    blockCheckedAt = now
    try {
      await connectDB()
      const doc = await GoogleAdsCache.findOne({ key: QUOTA_KEY }).lean<{ data?: { until?: number } }>()
      const until = Number(doc?.data?.until ?? 0)
      if (until > blockedUntil) blockedUntil = until
    } catch { /* DB blip: rely on the in-process value */ }
  }
  return blockedUntil > now ? blockedUntil : 0
}

function setQuotaBlock(until: number) {
  if (until <= blockedUntil) return
  blockedUntil = until
  console.warn(`[GoogleAds] daily operation quota exhausted - Google calls paused until ${new Date(until).toISOString()}`)
  connectDB()
    .then(() => GoogleAdsCache.updateOne({ key: QUOTA_KEY }, { $set: { data: { until }, fetchedAt: new Date() } }, { upsert: true }))
    .catch(() => {})
}

/** Current Google Ads availability, for the admin health view and UI notes. */
export async function googleAdsStatus(): Promise<{ configured: boolean; quotaBlocked: boolean; retryAt: string | null }> {
  if (!isGoogleAdsConfigured()) return { configured: false, quotaBlocked: false, retryAt: null }
  const until = await quotaBlockedUntil()
  return { configured: true, quotaBlocked: until > 0, retryAt: until ? new Date(until).toISOString() : null }
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

// ─── One paced, quota-aware Google Ads request ────────────────────────────────
// Requests go out one at a time per process with a small gap, so bursts (many
// users, 7-country Global lookups) don't trip the per-second account limit.
let pacer: Promise<unknown> = Promise.resolve()
const MIN_GAP_MS = 250
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function parseRetrySeconds(body: string): { scope: string | null; seconds: number | null } {
  try {
    const j = JSON.parse(body)
    const err = j?.error?.details?.[0]?.errors?.[0]
    const scope = err?.details?.quotaErrorDetails?.rateScope ?? null
    const delay = String(err?.details?.quotaErrorDetails?.retryDelay ?? '')
    const m = delay.match(/(\d+(?:\.\d+)?)s/) ?? String(err?.message ?? '').match(/Retry in (\d+) seconds/)
    return { scope, seconds: m ? Number(m[1]) : null }
  } catch { return { scope: null, seconds: null } }
}

async function adsRequest<T>(path: string, body: unknown): Promise<T> {
  const until = await quotaBlockedUntil()
  if (until) throw new GoogleAdsError('Google Ads daily quota exhausted', 'quota', until)

  const run = async (): Promise<T> => {
    const token = await getAccessToken()
    const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID)
    const headers: Record<string, string> = {
      'Authorization':   `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      'Content-Type':    'application/json',
    }
    const loginId = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
    if (loginId) headers['login-customer-id'] = loginId

    for (let attempt = 0; attempt < 2; attempt++) {
      if (blockedUntil > Date.now()) throw new GoogleAdsError('Google Ads daily quota exhausted', 'quota', blockedUntil)
      recordGoogleCall()
      const res = await fetch(`https://googleads.googleapis.com/${V}/customers/${customerId}${path}`, {
        method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store',
      })
      if (res.ok) return await res.json() as T

      const text = await res.text().catch(() => '')
      if (res.status === 429) {
        const { scope, seconds } = parseRetrySeconds(text)
        // Daily operation cap (or any long wait): lock app-wide, never retry.
        if (scope === 'DEVELOPER' || (seconds != null && seconds > 60)) {
          const lockUntil = Date.now() + (seconds ?? 3600) * 1000
          setQuotaBlock(lockUntil)
          throw new GoogleAdsError('Google Ads daily quota exhausted', 'quota', lockUntil)
        }
        // Short per-second limit: wait what Google asks (capped), retry once.
        if (attempt === 0) { await sleep(Math.min(8, seconds ?? 2) * 1000 + 200); continue }
        throw new GoogleAdsError(`Google Ads rate limited: ${text.slice(0, 200)}`, 'rate')
      }
      if (res.status >= 500 && attempt === 0) { await sleep(800); continue }
      if (res.status === 404) {
        throw new GoogleAdsError(
          `Google Ads API ${V} returned 404 - that version has almost certainly been sunset. ` +
          `Set GOOGLE_ADS_API_VERSION to a current one (see https://developers.google.com/google-ads/api/docs/sunset-dates). Body: ${text.slice(0, 200)}`, 'http')
      }
      throw new GoogleAdsError(`Google Ads API ${res.status}: ${text.slice(0, 500)}`, res.status === 401 || res.status === 403 ? 'auth' : 'http')
    }
    throw new GoogleAdsError('Google Ads request failed', 'http')
  }

  const p = pacer.then(async () => { try { return await run() } finally { await sleep(MIN_GAP_MS) } })
  pacer = p.catch(() => {})
  return p
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

/** Historical metrics for keywords in ONE country: cache first, then a single batched
 *  request for only the misses. On failure, stale stored rows are used. Never throws. */
async function metricsForGeo(keywords: string[], geoId: string, meta?: GoogleMetricsMeta): Promise<Map<string, GoogleMetric>> {
  const out = new Map<string, GoogleMetric>()
  const kws = normKws(keywords).slice(0, 1000)
  if (!kws.length) return out

  const stored = await readStored(kws.map(k => metricKey(geoId, k)))
  const misses: string[] = []
  for (const kw of kws) {
    const s = stored.get(metricKey(geoId, kw))
    if (s && isFresh(s)) { if (s.m) out.set(kw, s.m) }
    else misses.push(kw)
  }
  if (!misses.length) return out

  // Coalesce identical concurrent lookups (several routes ask for the same keyword at once).
  const flightKey = `gads-hist:${geoId}:${misses.join('')}`
  try {
    const fetched = await singleFlight(flightKey, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await adsRequest<{ results?: any[] }>(':generateKeywordHistoricalMetrics', {
        keywords: misses,
        geoTargetConstants: [`geoTargetConstants/${geoId}`],
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        language: LANG_EN,
      })
      const got = new Map<string, GoogleMetric>()
      for (const r of j.results ?? []) {
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
      writeStored(misses.map(kw => ({ key: metricKey(geoId, kw), m: got.get(kw) ?? null })))
      return got
    })
    for (const [k, v] of fetched) out.set(k, v)
  } catch (e) {
    // The lockout is logged once when it trips; don't repeat it for every country/keyword.
    if (!(e instanceof GoogleAdsError && e.kind === 'quota')) console.error(`[GoogleAds] metrics (geo ${geoId}) failed:`, e instanceof Error ? e.message : e)
    noteFailure(meta, e)
    // Stale beats blank: serve the last stored answer for anything Google couldn't refresh.
    for (const kw of misses) {
      const s = stored.get(metricKey(geoId, kw))
      if (s?.m) { out.set(kw, s.m); if (meta) meta.stale = true }
    }
  }
  return out
}

/**
 * Global = the sum of the tracked countries (omitting geoTargetConstants returns
 * an EMPTY result for this endpoint in practice). Reads the same per-country rows
 * as the country chart, so after the first lookup it costs nothing.
 */
async function metricsGlobal(keywords: string[], meta?: GoogleMetricsMeta): Promise<Map<string, GoogleMetric>> {
  const perGeo: Map<string, GoogleMetric>[] = []
  for (const iso of Object.keys(GEO_TARGETS)) {
    // Once the daily quota trips, the remaining countries still read the cache.
    perGeo.push(await metricsForGeo(keywords, GEO_TARGETS[iso].id, meta))
  }
  const BAND_RANK: Record<string, number> = { UNSPECIFIED: 0, UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 }
  const out = new Map<string, GoogleMetric>()
  for (const raw of normKws(keywords)) {
    let searches = 0, compIdxSum = 0, compIdxCount = 0, cpcLowSum = 0, cpcLowCount = 0, cpcHighSum = 0, cpcHighCount = 0
    const monthly: number[] = []
    let bestBand = 'UNSPECIFIED'
    let found = false
    for (const m of perGeo) {
      const g = m.get(raw)
      if (!g) continue
      found = true
      searches += g.searches
      for (let i = 0; i < g.monthly.length; i++) monthly[i] = (monthly[i] ?? 0) + g.monthly[i]
      if (g.competitionIndex != null) { compIdxSum += g.competitionIndex; compIdxCount++ }
      if (g.cpcLow != null) { cpcLowSum += g.cpcLow; cpcLowCount++ }
      if (g.cpcHigh != null) { cpcHighSum += g.cpcHigh; cpcHighCount++ }
      if ((BAND_RANK[g.competition] ?? 0) > (BAND_RANK[bestBand] ?? 0)) bestBand = g.competition
    }
    if (!found) continue
    out.set(raw, {
      keyword: raw,
      searches,
      competition: bestBand,
      competitionIndex: compIdxCount ? Math.round(compIdxSum / compIdxCount) : null,
      cpcLow: cpcLowCount ? parseFloat((cpcLowSum / cpcLowCount).toFixed(2)) : null,
      cpcHigh: cpcHighCount ? parseFloat((cpcHighSum / cpcHighCount).toFixed(2)) : null,
      monthly,
    })
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
  const results: { iso: string; searches: number }[] = []
  for (const iso of Object.keys(GEO_TARGETS)) {
    const m = await metricsForGeo([kw], GEO_TARGETS[iso].id, meta)
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
      const j = await adsRequest<any>('/googleAds:searchStream', { query: 'SELECT customer.currency_code FROM customer LIMIT 1' })
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
      })
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
