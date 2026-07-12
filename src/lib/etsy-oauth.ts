import crypto from 'crypto'

/**
 * Etsy Open API v3 — OAuth 2.0 Authorization Code flow with PKCE.
 * Docs: https://developers.etsy.com/documentation/essentials/authentication
 *
 * Setup required by the shop owner (once), in the Etsy developer console:
 *   • Register the redirect URI exactly as ETSY_REDIRECT_URI (or
 *     <origin>/api/etsy/oauth/callback) under the app's OAuth settings.
 *   • ETSY_API_KEY / ETSY_SHARED_SECRET are the same keystring/secret already
 *     used for public calls.
 */

export const ETSY_OAUTH_AUTHORIZE = 'https://www.etsy.com/oauth/connect'
export const ETSY_OAUTH_TOKEN     = 'https://api.etsy.com/v3/public/oauth/token'

// Scopes needed for Shop Insights: shop info, listings, and sales/receipts.
// Only what the "My Shop" feature actually reads — no unused scopes (e.g. email_r
// was dropped as it is never used, to satisfy least-privilege review).
export const ETSY_SCOPES = ['shops_r', 'listings_r', 'transactions_r'] as const

const CLIENT_ID = process.env.ETSY_API_KEY ?? ''

// ─── PKCE ─────────────────────────────────────────────────────────────────────
const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(32)) // 43 chars, RFC 7636 range
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function randomState(): string {
  return b64url(crypto.randomBytes(24))
}

// ─── Redirect URI ─────────────────────────────────────────────────────────────
export function getRedirectUri(reqUrl: string): string {
  if (process.env.ETSY_REDIRECT_URI) return process.env.ETSY_REDIRECT_URI
  const origin = new URL(reqUrl).origin
  return `${origin}/api/etsy/oauth/callback`
}

// ─── Authorization URL ────────────────────────────────────────────────────────
export function buildAuthorizeUrl(opts: { redirectUri: string; state: string; challenge: string }): string {
  const p = new URLSearchParams({
    response_type:         'code',
    client_id:             CLIENT_ID,
    redirect_uri:          opts.redirectUri,
    scope:                 ETSY_SCOPES.join(' '),
    state:                 opts.state,
    code_challenge:        opts.challenge,
    code_challenge_method: 'S256',
  })
  return `${ETSY_OAUTH_AUTHORIZE}?${p.toString()}`
}

// ─── Token exchange / refresh ─────────────────────────────────────────────────
export interface EtsyTokenResponse {
  access_token:  string   // format: "{user_id}.{token}"
  token_type:    string   // "Bearer"
  expires_in:    number   // 3600
  refresh_token: string
}

async function tokenRequest(body: Record<string, string>): Promise<EtsyTokenResponse> {
  const res = await fetch(ETSY_OAUTH_TOKEN, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(body).toString(),
    cache:   'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Etsy OAuth token error ${res.status}: ${text}`)
  }
  return res.json() as Promise<EtsyTokenResponse>
}

export function exchangeCodeForToken(opts: { code: string; verifier: string; redirectUri: string }): Promise<EtsyTokenResponse> {
  return tokenRequest({
    grant_type:    'authorization_code',
    client_id:     CLIENT_ID,
    redirect_uri:  opts.redirectUri,
    code:          opts.code,
    code_verifier: opts.verifier,
  })
}

export function refreshEtsyToken(refreshToken: string): Promise<EtsyTokenResponse> {
  return tokenRequest({
    grant_type:    'refresh_token',
    client_id:     CLIENT_ID,
    refresh_token: refreshToken,
  })
}

/** The Etsy user id is the segment before the first dot of the access token. */
export function userIdFromToken(accessToken: string): string {
  return accessToken.split('.')[0] ?? ''
}
