import { NextRequest, NextResponse } from 'next/server'
import { isOAuthProvider, providerEnabled, buildAuthorizeUrl } from '@/lib/auth/oauth'
import { siteUrl } from '@/lib/seo/site'

// Initiate social login: set a CSRF state cookie + the post-login redirect, then
// bounce to the provider's consent screen.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const IS_PROD = process.env.NODE_ENV === 'production'

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const base = siteUrl()

  if (!isOAuthProvider(provider) || !providerEnabled(provider)) {
    return NextResponse.redirect(new URL('/login?error=oauth_unavailable', base))
  }

  // Only allow a relative in-app redirect target (blocks open-redirect abuse).
  const raw = req.nextUrl.searchParams.get('redirect') || '/dashboard'
  const dest = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'

  const state = globalThis.crypto.randomUUID()
  const res = NextResponse.redirect(buildAuthorizeUrl(provider, state))
  const opts = { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const, path: '/', maxAge: 600 }
  res.cookies.set('oauth_state', state, opts)
  res.cookies.set('oauth_redirect', dest, opts)
  return res
}
