/**
 * Google Ads API — Keyword Planner (real Google search volume + geography).
 * Uses the REST interface for generateKeywordHistoricalMetrics. No SDK.
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
 *   GOOGLE_ADS_API_VERSION           ← defaults to v18; bump if Google sunsets it
 */

/**
 * Google sunsets Ads API versions roughly yearly. A sunset version 404s on every
 * call; a *deprecated-but-not-yet-removed* version 400s with UNSUPPORTED_VERSION.
 * Verified 2026-07-27 with live credentials: v20 is now deprecated/blocked, and
 * v21–v24 all route. v24 is the newest live version, so it's the default here —
 * it has the longest runway before the next sunset.
 *
 * Override with GOOGLE_ADS_API_VERSION when Google retires this one; the error
 * thrown below names the variable so the fix is obvious from the logs.
 */
const V = process.env.GOOGLE_ADS_API_VERSION || 'v24'
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
// Used by the "Searchers by Country" breakdown (fixed 6-country doughnut).
export const GEO_TARGETS: Record<string, { id: string; name: string; color: string }> = {
  US: { id: '2840', name: 'United States', color: '#FB5E09' },
  GB: { id: '2826', name: 'United Kingdom', color: '#3D3E3B' },
  CA: { id: '2124', name: 'Canada', color: '#6E6E64' },
  AU: { id: '2036', name: 'Australia', color: '#B9791A' },
  DE: { id: '2276', name: 'Germany', color: '#5A5A5A' },
  FR: { id: '2250', name: 'France', color: '#CF463A' },
}

// ─── User-selectable country filter (like eRank's) → geoTargetConstant ─────────
// `id: null` = Global (omit the geo target, so Google returns worldwide volume).
// Search volume, CPC and competition are all geo-specific, so this genuinely
// changes the Google numbers; Etsy metrics are marketplace-global and don't move.
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

// ─── Access token (module-cached ~55 min) ─────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
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
  if (!res.ok) throw new Error(`Google OAuth token error ${res.status}: ${await res.text().catch(() => '')}`)
  const j = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }
  return j.access_token
}

// ─── Core call: historical metrics for a set of keywords in one geo ────────────
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

async function historicalMetrics(keywords: string[], geoId: string | null): Promise<Map<string, GoogleMetric>> {
  const out = new Map<string, GoogleMetric>()
  const kws = [...new Set(keywords.map(k => k.toLowerCase().trim()).filter(Boolean))].slice(0, 1000)
  if (!kws.length) return out

  const token = await getAccessToken()
  const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID)
  const headers: Record<string, string> = {
    'Authorization':  `Bearer ${token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type':   'application/json',
  }
  const loginId = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
  if (loginId) headers['login-customer-id'] = loginId

  const res = await fetch(
    `https://googleads.googleapis.com/${V}/customers/${customerId}:generateKeywordHistoricalMetrics`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        keywords: kws,
        // null geo = Global: omit the target so Google returns worldwide volume.
        ...(geoId ? { geoTargetConstants: [`geoTargetConstants/${geoId}`] } : {}),
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        language: LANG_EN,
      }),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // A sunset API version 404s on every endpoint. Without this the symptom is a
    // bare "404" and it looks like a bad customer id or a broken URL.
    if (res.status === 404) {
      throw new Error(
        `Google Ads API ${V} returned 404 — that version has almost certainly been sunset. ` +
        `Set GOOGLE_ADS_API_VERSION to a current one (see https://developers.google.com/google-ads/api/docs/sunset-dates). Body: ${body.slice(0, 200)}`,
      )
    }
    throw new Error(`Google Ads API ${res.status}: ${body}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = await res.json() as { results?: any[] }
  for (const r of j.results ?? []) {
    const m = r.keywordMetrics
    if (!m) continue
    const monthly = (m.monthlySearchVolumes ?? []).map((v: { monthlySearches?: string }) => Number(v.monthlySearches ?? 0))
    out.set(String(r.text).toLowerCase(), {
      keyword:     String(r.text),
      searches:    Number(m.avgMonthlySearches ?? 0),
      competition: String(m.competition ?? 'UNSPECIFIED'),
      competitionIndex: m.competitionIndex != null ? Number(m.competitionIndex) : null,
      cpcLow:      microsToCurrency(m.lowTopOfPageBidMicros),
      cpcHigh:     microsToCurrency(m.highTopOfPageBidMicros),
      monthly,
    })
  }
  return out
}

/** Google monthly search volume for many keywords (default geo US). Safe: returns
 *  an empty map (never throws) when Google Ads isn't configured or the call fails. */
export async function googleKeywordMetrics(keywords: string[], geoIso = 'US'): Promise<Map<string, GoogleMetric>> {
  if (!isGoogleAdsConfigured()) return new Map()
  try {
    return await historicalMetrics(keywords, geoIdFor(normalizeGeo(geoIso)))
  } catch (e) {
    console.error('[GoogleAds] keyword metrics failed:', e)
    return new Map()
  }
}

/** Per-country search distribution for a single keyword, as CountryData[] (%). */
export async function googleCountryBreakdown(keyword: string): Promise<{ country: string; percentage: number; color: string }[]> {
  if (!isGoogleAdsConfigured()) return []
  try {
    const isos = Object.keys(GEO_TARGETS)
    // Sequential, not Promise.all: firing all six geo calls at once (plus the
    // trend-line call in the trends route) trips Google's rate limit (429), which
    // silently drops whichever calls lose the race. Sequential is ~1–2s and the
    // result is cached, so the trend line and country breakdown both survive.
    const results: { iso: string; searches: number }[] = []
    for (const iso of isos) {
      const m = await historicalMetrics([keyword], GEO_TARGETS[iso].id).catch(() => new Map<string, GoogleMetric>())
      results.push({ iso, searches: m.get(keyword.toLowerCase())?.searches ?? 0 })
    }
    const total = results.reduce((s, r) => s + r.searches, 0)
    if (!total) return []
    return results
      .filter(r => r.searches > 0)
      .sort((a, b) => b.searches - a.searches)
      .map(r => ({ country: GEO_TARGETS[r.iso].name, percentage: parseFloat(((r.searches / total) * 100).toFixed(1)), color: GEO_TARGETS[r.iso].color }))
  } catch (e) {
    console.error('[GoogleAds] country breakdown failed:', e)
    return []
  }
}

// ─── Account currency (cached for the process) ────────────────────────────────
// CPC bids come back in the Ads account's OWN currency with no code attached, so
// every CPC we show has to be labelled with this. Cached because it never changes
// for a given account and costs a round-trip.
let cachedCurrency: string | null = null

export async function googleAccountCurrency(): Promise<string | null> {
  if (!isGoogleAdsConfigured()) return null
  if (cachedCurrency) return cachedCurrency
  try {
    const token = await getAccessToken()
    const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID)
    const headers: Record<string, string> = {
      'Authorization':  `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      'Content-Type':   'application/json',
    }
    const loginId = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
    if (loginId) headers['login-customer-id'] = loginId

    const res = await fetch(`https://googleads.googleapis.com/${V}/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ query: 'SELECT customer.currency_code FROM customer LIMIT 1' }),
    })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j = await res.json() as any
    const code = (Array.isArray(j) ? j[0]?.results?.[0] : j?.results?.[0])?.customer?.currencyCode
    if (code) cachedCurrency = String(code)
    return cachedCurrency
  } catch (e) {
    console.error('[GoogleAds] currency lookup failed:', e)
    return null
  }
}

// ─── Keyword ideas: Google-suggested keywords for a seed, each with real metrics ─
// This is genuine keyword DISCOVERY (generateKeywordIdeas), not the historical
// lookup — Google returns terms we never asked about, so it surfaces high-volume /
// low-competition long-tails that an Etsy-tag sample can't. Every metric is real.
export interface GoogleIdea {
  keyword: string
  searches: number
  competition: string          // LOW | MEDIUM | HIGH | UNSPECIFIED
  competitionIndex: number | null
  cpcLow: number | null
  cpcHigh: number | null
}

/** Up to `limit` Google keyword ideas for a seed phrase. Safe: [] when unconfigured or on error. */
export async function googleKeywordIdeas(seed: string, geoIso = 'US', limit = 40): Promise<GoogleIdea[]> {
  if (!isGoogleAdsConfigured()) return []
  const term = seed.toLowerCase().trim()
  if (!term) return []
  try {
    const token = await getAccessToken()
    const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID)
    const headers: Record<string, string> = {
      'Authorization':  `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      'Content-Type':   'application/json',
    }
    const loginId = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
    if (loginId) headers['login-customer-id'] = loginId

    const res = await fetch(`https://googleads.googleapis.com/${V}/customers/${customerId}:generateKeywordIdeas`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({
        keywordSeed: { keywords: [term] },
        // null geo = Global: omit the target for worldwide ideas.
        ...(geoIdFor(normalizeGeo(geoIso)) ? { geoTargetConstants: [`geoTargetConstants/${geoIdFor(normalizeGeo(geoIso))}`] } : {}),
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        language: LANG_EN,
        pageSize: Math.min(Math.max(limit, 1), 100),
      }),
    })
    if (!res.ok) {
      console.error('[GoogleAds] keyword ideas failed:', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return []
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j = await res.json() as { results?: any[] }
    return (j.results ?? [])
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
      .slice(0, limit)
  } catch (e) {
    console.error('[GoogleAds] keyword ideas error:', e)
    return []
  }
}
