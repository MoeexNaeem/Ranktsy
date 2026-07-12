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

const V = process.env.GOOGLE_ADS_API_VERSION || 'v18'
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
export const GEO_TARGETS: Record<string, { id: string; name: string; color: string }> = {
  US: { id: '2840', name: 'United States', color: '#FB5E09' },
  GB: { id: '2826', name: 'United Kingdom', color: '#3D3E3B' },
  CA: { id: '2124', name: 'Canada', color: '#6E6E64' },
  AU: { id: '2036', name: 'Australia', color: '#B9791A' },
  DE: { id: '2276', name: 'Germany', color: '#5A5A5A' },
  FR: { id: '2250', name: 'France', color: '#CF463A' },
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
export interface GoogleMetric { keyword: string; searches: number; competition: string; monthly: number[] }

async function historicalMetrics(keywords: string[], geoId: string): Promise<Map<string, GoogleMetric>> {
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
        geoTargetConstants: [`geoTargetConstants/${geoId}`],
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        language: LANG_EN,
      }),
      cache: 'no-store',
    },
  )
  if (!res.ok) throw new Error(`Google Ads API ${res.status}: ${await res.text().catch(() => '')}`)

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
    return await historicalMetrics(keywords, GEO_TARGETS[geoIso]?.id ?? '2840')
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
    const results = await Promise.all(
      isos.map(async iso => {
        const m = await historicalMetrics([keyword], GEO_TARGETS[iso].id).catch(() => new Map<string, GoogleMetric>())
        return { iso, searches: m.get(keyword.toLowerCase())?.searches ?? 0 }
      }),
    )
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
