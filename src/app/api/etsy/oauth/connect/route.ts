import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createPkce, randomState, buildAuthorizeUrl, getRedirectUri, appUrl } from '@/lib/etsy-oauth'

export const runtime = 'nodejs'

const IS_PROD = process.env.NODE_ENV === 'production'
const cookieOpts = { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const, path: '/', maxAge: 600 }

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(appUrl('/login?redirect=/dashboard', req.url))
  }
  if (!process.env.ETSY_API_KEY) {
    return NextResponse.redirect(appUrl('/dashboard?etsy=misconfigured', req.url))
  }

  const { verifier, challenge } = createPkce()
  const state = randomState()
  const redirectUri = getRedirectUri(req.url)

  // Etsy rejects the authorize request with "The requested redirect URL is not
  // permitted" unless THIS exact string is registered in the Etsy app's OAuth
  // Redirect URIs. Log it so it can be copied verbatim into the Etsy console, and
  // warn loudly on the classic prod misconfig (a localhost/http origin leaking
  // through because SITE_URL / NEXT_PUBLIC_APP_URL / ETSY_REDIRECT_URI is unset).
  console.log('[Etsy OAuth] redirect_uri =', redirectUri)
  if (process.env.NODE_ENV === 'production' && /^https?:\/\/localhost|^http:\/\//i.test(redirectUri)) {
    console.warn(`[Etsy OAuth] redirect_uri looks wrong for production ("${redirectUri}"). Set ETSY_REDIRECT_URI (or SITE_URL) to your real https origin, e.g. https://rankkw.com/api/etsy/oauth/callback, and register that exact URL in the Etsy app.`)
  }

  const authorizeUrl = buildAuthorizeUrl({ redirectUri, state, challenge })
  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set('etsy_oauth_state', state, cookieOpts)
  res.cookies.set('etsy_oauth_verifier', verifier, cookieOpts)
  return res
}
