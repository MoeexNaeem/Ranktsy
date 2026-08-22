/**
 * Social login (Google + Microsoft/Outlook) - OAuth 2.0 Authorization Code flow,
 * wired into the app's existing JWT session. Each provider is independent and is
 * only "enabled" when both its client id and secret are present in the env, so
 * the buttons never appear for an unconfigured provider.
 *
 * Env vars:
 *   GOOGLE_LOGIN_CLIENT_ID / GOOGLE_LOGIN_CLIENT_SECRET
 *   MICROSOFT_LOGIN_CLIENT_ID / MICROSOFT_LOGIN_CLIENT_SECRET   (tenant: common)
 *
 * These are separate from the Google **Ads** OAuth client used for keyword data.
 */
import { siteUrl } from '@/lib/seo/site'

export type OAuthProvider = 'google' | 'microsoft'
export const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'microsoft']
export const isOAuthProvider = (v: string): v is OAuthProvider => (OAUTH_PROVIDERS as string[]).includes(v)

interface ProviderConfig {
  clientIdEnv: string
  clientSecretEnv: string
  authorizeUrl: string
  tokenUrl: string
  scope: string
}

const CONFIG: Record<OAuthProvider, ProviderConfig> = {
  google: {
    clientIdEnv: 'GOOGLE_LOGIN_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_LOGIN_CLIENT_SECRET',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  microsoft: {
    clientIdEnv: 'MICROSOFT_LOGIN_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_LOGIN_CLIENT_SECRET',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid email profile',
  },
}

function creds(p: OAuthProvider) {
  return { clientId: process.env[CONFIG[p].clientIdEnv], clientSecret: process.env[CONFIG[p].clientSecretEnv] }
}

/** True only when the provider's client id AND secret are both configured. */
export function providerEnabled(p: OAuthProvider): boolean {
  const { clientId, clientSecret } = creds(p)
  return Boolean(clientId && clientSecret)
}

/** The exact redirect URI - must match what's registered in the provider console. */
export function redirectUri(p: OAuthProvider): string {
  return `${siteUrl()}/api/auth/oauth/${p}/callback`
}

export function buildAuthorizeUrl(p: OAuthProvider, state: string): string {
  const cfg = CONFIG[p]
  const { clientId } = creds(p)
  const params = new URLSearchParams({
    client_id: clientId ?? '',
    redirect_uri: redirectUri(p),
    response_type: 'code',
    scope: cfg.scope,
    state,
    prompt: 'select_account',
  })
  if (p === 'google') params.set('access_type', 'online')
  else params.set('response_mode', 'query')
  return `${cfg.authorizeUrl}?${params.toString()}`
}

export interface OAuthProfile { email: string; name: string }

/** Decode a JWT payload (no signature check - the token arrived directly from the
 *  provider's token endpoint over TLS in a confidential-client exchange). */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch { return null }
}

/** Exchange the authorization code for the user's verified email + name. */
export async function exchangeCodeForProfile(p: OAuthProvider, code: string): Promise<OAuthProfile | null> {
  const cfg = CONFIG[p]
  const { clientId, clientSecret } = creds(p)
  if (!clientId || !clientSecret) return null

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(p),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    console.error('[oauth token]', p, res.status, await res.text().catch(() => ''))
    return null
  }
  const tokens = await res.json() as { id_token?: string }
  if (!tokens.id_token) return null

  const claims = decodeJwtPayload(tokens.id_token)
  if (!claims) return null
  const email = String(claims.email || claims.preferred_username || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return null
  const name = String(claims.name || claims.given_name || email.split('@')[0]).trim()
  return { email, name }
}
