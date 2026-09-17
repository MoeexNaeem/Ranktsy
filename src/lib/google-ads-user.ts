/**
 * A user's OWN Google Ads account, connected via OAuth ("Connect Google Ads").
 *
 * This is the campaign-management side of Rankkw (create/manage Search campaigns
 * and read their reports), which is what the Google Ads API Required Minimum
 * Functionality asks of any tool that also uses Keyword Planner data. It is
 * separate from lib/google-ads.ts, which reads Keyword Planner data with the app's
 * own account; both share the same developer token and quota lockout (adsApiCall).
 *
 * Until Google verifies the `adwords` OAuth scope, only admins and the emails in
 * GOOGLE_ADS_BETA_EMAILS can use it (unverified sensitive scopes are capped at 100
 * users for the lifetime of the project).
 */
import crypto from 'crypto'
import { connectDB } from '@/lib/db'
import { GoogleAdsConnection, type IGoogleAdsAccountRef } from '@/lib/models'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { singleFlight } from '@/lib/concurrency'
import { memCache } from '@/lib/cache'
import { adsApiCall, GoogleAdsError } from '@/lib/google-ads'
import { getAppOrigin } from '@/lib/etsy-oauth'
import { isAdmin } from '@/lib/auth/roles'
import type { AuthUser } from '@/types'

export const ADS_SCOPES = ['https://www.googleapis.com/auth/adwords', 'openid', 'email']
export const ADS_STATE_COOKIE = 'gads_user_oauth_state'

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '')
/** 1234567890 → 123-456-7890 */
export const formatCustomerId = (id: string) => digits(id).replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')

// ─── Access gate ──────────────────────────────────────────────────────────────
export function isGoogleAdsClientConfigured(): boolean {
  return !!(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET && process.env.GOOGLE_ADS_DEVELOPER_TOKEN)
}

/** Who may see Connect Google Ads. Open to everyone only when GOOGLE_ADS_MANAGE_PUBLIC=true (after OAuth verification). */
export function canUseGoogleAdsManager(user: AuthUser | null | undefined): boolean {
  if (!user || !isGoogleAdsClientConfigured()) return false
  // Tolerant: true / TRUE / yes / 1 / on (quotes and spaces ignored). Anything else keeps it gated.
  if (/^(true|yes|1|on)$/i.test((process.env.GOOGLE_ADS_MANAGE_PUBLIC ?? '').trim().replace(/^["']|["']$/g, ''))) return true
  if (isAdmin(user)) return true
  const beta = (process.env.GOOGLE_ADS_BETA_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return beta.includes(user.email.toLowerCase())
}

// ─── OAuth ────────────────────────────────────────────────────────────────────
export function adsRedirectUri(reqUrl: string): string {
  return process.env.GOOGLE_ADS_USER_REDIRECT_URI || `${getAppOrigin(reqUrl)}/api/google-ads/connect/callback`
}

export function newOAuthState(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export function buildAdsAuthorizeUrl(reqUrl: string, state: string): string {
  const p = new URLSearchParams({
    client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
    redirect_uri:  adsRedirectUri(reqUrl),
    response_type: 'code',
    scope:         ADS_SCOPES.join(' '),
    access_type:   'offline',
    prompt:        'consent',          // always return a refresh token
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
}

interface TokenResponse { access_token: string; expires_in: number; refresh_token?: string; id_token?: string; scope?: string }

export async function exchangeAdsCode(reqUrl: string, code: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      redirect_uri:  adsRedirectUri(reqUrl),
      code,
      grant_type:    'authorization_code',
    }).toString(),
    cache: 'no-store',
  })
  const j = await res.json().catch(() => ({})) as TokenResponse & { error?: string; error_description?: string }
  if (!res.ok || !j.access_token) throw new Error(j.error_description || j.error || 'Google did not return a token.')
  return j
}

/** Email from the id_token (already delivered by Google over TLS; used for display only). */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.email === 'string' ? payload.email : null
  } catch { return null }
}

export class AdsNotConnectedError extends Error {
  constructor(message = 'Connect your Google Ads account first.') { super(message) }
}

/** Fresh access token for a user's connection (cached ~50 min, one refresh at a time). */
export async function userAccessToken(userId: string): Promise<string> {
  const cached = memCache.get<string>(`gads-user-token:${userId}`)
  if (cached) return cached
  return singleFlight(`gads-user-token:${userId}`, async () => {
    const again = memCache.get<string>(`gads-user-token:${userId}`)
    if (again) return again
    await connectDB()
    const conn = await GoogleAdsConnection.findOne({ userId }).select('+refreshToken').lean<{ refreshToken: string } | null>()
    if (!conn) throw new AdsNotConnectedError()
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        refresh_token: decryptSecret(conn.refreshToken) ?? '',
        grant_type:    'refresh_token',
      }).toString(),
      cache: 'no-store',
    })
    const j = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string }
    if (!res.ok || !j.access_token) {
      // invalid_grant = the user revoked access or the token expired: ask them to reconnect.
      if (j.error === 'invalid_grant') {
        await GoogleAdsConnection.updateOne({ userId }, { $set: { needsReconnect: true, lastError: 'Google access was revoked or expired. Please reconnect.' } })
        throw new AdsNotConnectedError('Google access was revoked or expired. Please reconnect Google Ads.')
      }
      throw new Error(`Google sign-in refresh failed${j.error ? ` (${j.error})` : ''}.`)
    }
    memCache.set(`gads-user-token:${userId}`, j.access_token, Math.max(60, (j.expires_in ?? 3600) - 600))
    return j.access_token
  })
}

// ─── Queries ──────────────────────────────────────────────────────────────────
/** Run a GAQL query against one customer, following pagination. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function gaqlSearch<Row = any>(token: string, customerId: string, loginCustomerId: string | null, query: string, maxRows = 2000): Promise<Row[]> {
  const rows: Row[] = []
  let pageToken: string | undefined
  do {
    const j = await adsApiCall<{ results?: Row[]; nextPageToken?: string }>({
      token,
      path: `customers/${digits(customerId)}/googleAds:search`,
      body: { query, ...(pageToken ? { pageToken } : {}) },
      loginCustomerId,
    })
    rows.push(...(j.results ?? []))
    pageToken = j.nextPageToken
  } while (pageToken && rows.length < maxRows)
  return rows
}

/** Every client (non-manager) account this Google login can operate, with the manager to route through. */
export async function discoverAccounts(token: string): Promise<IGoogleAdsAccountRef[]> {
  const list = await adsApiCall<{ resourceNames?: string[] }>({ token, path: 'customers:listAccessibleCustomers', method: 'GET' })
  const ids = (list.resourceNames ?? []).map(r => r.split('/')[1]).filter(Boolean)
  const found = new Map<string, IGoogleAdsAccountRef>()

  for (const id of ids.slice(0, 50)) {
    try {
      const [me] = await gaqlSearch<{ customer: { id: string; descriptiveName?: string; currencyCode?: string; timeZone?: string; manager?: boolean; testAccount?: boolean } }>(
        token, id, id,
        'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account FROM customer LIMIT 1',
      )
      if (!me) continue
      if (!me.customer.manager) {
        if (!found.has(id)) found.set(id, {
          customerId: id, name: me.customer.descriptiveName || formatCustomerId(id),
          currency: me.customer.currencyCode ?? null, timeZone: me.customer.timeZone ?? null,
          testAccount: !!me.customer.testAccount, loginCustomerId: null,
        })
        continue
      }
      // A manager: list the client accounts directly under it.
      const children = await gaqlSearch<{ customerClient: { id: string; descriptiveName?: string; currencyCode?: string; timeZone?: string; manager?: boolean; testAccount?: boolean; level?: string } }>(
        token, id, id,
        'SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.test_account, customer_client.level FROM customer_client WHERE customer_client.level = 1',
        500,
      )
      for (const c of children) {
        const cc = c.customerClient
        if (cc.manager || found.has(String(cc.id))) continue
        found.set(String(cc.id), {
          customerId: String(cc.id), name: cc.descriptiveName || formatCustomerId(String(cc.id)),
          currency: cc.currencyCode ?? null, timeZone: cc.timeZone ?? null,
          testAccount: !!cc.testAccount, loginCustomerId: id,
        })
      }
    } catch (e) {
      // One unreachable account (cancelled, no permission) must not hide the rest.
      if (e instanceof GoogleAdsError && e.kind === 'quota') throw e
      console.warn(`[GoogleAdsUser] skipped account ${id}:`, e instanceof Error ? e.message : e)
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Connection helpers ───────────────────────────────────────────────────────
export async function saveConnection(userId: string, refreshToken: string, googleEmail: string | null, accounts: IGoogleAdsAccountRef[]) {
  await connectDB()
  const existing = await GoogleAdsConnection.findOne({ userId }).lean<{ selectedCustomerId?: string | null } | null>()
  const keep = existing?.selectedCustomerId && accounts.some(a => a.customerId === existing.selectedCustomerId)
  const selected = keep ? existing!.selectedCustomerId! : accounts.length === 1 ? accounts[0].customerId : null
  memCache.delete(`gads-user-token:${userId}`)
  await GoogleAdsConnection.updateOne(
    { userId },
    { $set: { refreshToken: encryptSecret(refreshToken), googleEmail, accounts, selectedCustomerId: selected, needsReconnect: false, lastError: null } },
    { upsert: true },
  )
}

export interface ConnectionView {
  connected: boolean
  googleEmail: string | null
  accounts: (IGoogleAdsAccountRef & { display: string })[]
  selectedCustomerId: string | null
  needsReconnect: boolean
  lastError: string | null
  connectedAt: string | null
}

export async function getConnectionView(userId: string): Promise<ConnectionView> {
  await connectDB()
  const c = await GoogleAdsConnection.findOne({ userId }).lean<{
    googleEmail: string | null; accounts: IGoogleAdsAccountRef[]; selectedCustomerId: string | null
    needsReconnect: boolean; lastError: string | null; createdAt?: Date
  } | null>()
  if (!c) return { connected: false, googleEmail: null, accounts: [], selectedCustomerId: null, needsReconnect: false, lastError: null, connectedAt: null }
  return {
    connected: true,
    googleEmail: c.googleEmail ?? null,
    accounts: (c.accounts ?? []).map(a => ({ ...a, display: formatCustomerId(a.customerId) })),
    selectedCustomerId: c.selectedCustomerId ?? null,
    needsReconnect: !!c.needsReconnect,
    lastError: c.lastError ?? null,
    connectedAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
  }
}

/** The account the campaign tools should act on, with a valid access token. */
export async function requireSelectedAccount(userId: string): Promise<{ token: string; account: IGoogleAdsAccountRef }> {
  await connectDB()
  const c = await GoogleAdsConnection.findOne({ userId }).lean<{ accounts: IGoogleAdsAccountRef[]; selectedCustomerId: string | null; needsReconnect: boolean } | null>()
  if (!c) throw new AdsNotConnectedError()
  if (c.needsReconnect) throw new AdsNotConnectedError('Google access was revoked or expired. Please reconnect Google Ads.')
  const account = c.accounts.find(a => a.customerId === c.selectedCustomerId)
  if (!account) throw new AdsNotConnectedError('Choose which Google Ads account to use.')
  return { token: await userAccessToken(userId), account }
}

export interface AccountStatus {
  /** e.g. NOT_CONVERSION_TRACKED, CONVERSION_TRACKING_MANAGED_BY_SELF, CONVERSION_TRACKING_MANAGED_BY_THIS_MANAGER */
  conversionTrackingStatus: string
  conversionTrackingEnabled: boolean
}

/** Settings that decide which campaign options are available in this account. */
export async function accountStatus(token: string, account: IGoogleAdsAccountRef): Promise<AccountStatus> {
  const [row] = await gaqlSearch<{ customer: { conversionTrackingSetting?: { conversionTrackingStatus?: string } } }>(
    token, account.customerId, account.loginCustomerId,
    'SELECT customer.id, customer.conversion_tracking_setting.conversion_tracking_status FROM customer LIMIT 1',
  )
  const status = row?.customer?.conversionTrackingSetting?.conversionTrackingStatus ?? 'UNKNOWN'
  return { conversionTrackingStatus: status, conversionTrackingEnabled: status !== 'NOT_CONVERSION_TRACKED' && status !== 'UNKNOWN' }
}

export async function disconnect(userId: string): Promise<void> {
  await connectDB()
  const c = await GoogleAdsConnection.findOne({ userId }).select('+refreshToken').lean<{ refreshToken: string } | null>()
  if (c?.refreshToken) {
    // Revoke at Google so the grant disappears from the user's Google account too.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decryptSecret(c.refreshToken) ?? '')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store',
    }).catch(() => {})
  }
  memCache.delete(`gads-user-token:${userId}`)
  await GoogleAdsConnection.deleteOne({ userId })
}

/** Map any error from this module to an HTTP status + message for API routes. */
export function adsErrorResponse(e: unknown): { status: number; error: string; code?: string } {
  if (e instanceof AdsNotConnectedError) return { status: 409, error: e.message, code: 'not_connected' }
  if (e instanceof GoogleAdsError) {
    if (e.kind === 'quota') return { status: 503, error: 'Google Ads data is temporarily unavailable. Please try again later.', code: 'quota' }
    if (e.kind === 'auth') return { status: 403, error: e.message || 'Google Ads denied access to this account.', code: 'auth' }
    return { status: 400, error: e.message, code: e.kind }
  }
  return { status: 500, error: e instanceof Error ? e.message : 'Google Ads request failed.' }
}
