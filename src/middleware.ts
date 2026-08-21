import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, verifyRefreshToken } from '@/lib/auth/jwt'
import { ACCESS_TOKEN_NAME, REFRESH_TOKEN_NAME } from '@/lib/auth/cookies'

const PROTECTED = ['/dashboard', '/profile', '/admin']
const AUTH_ONLY = ['/login', '/register', '/forgot-password', '/reset-password'] // redirect if already logged in

/**
 * API paths that MUST stay reachable without a session cookie. Everything else
 * under /api is login-gated here (see below) so the expensive AI / Etsy / Google
 * endpoints can't be hit anonymously to drain paid quotas. Keep this list tight.
 */
const PUBLIC_API = [
  '/api/auth/',            // login, register, otp, password reset, oauth, me, logout
  '/api/etsy/oauth/',      // Etsy connect + callback (handles its own login redirect)
  '/api/google/oauth/',    // Google Ads connect + callback
  '/api/lemonsqueezy/webhook', // signed server-to-server webhook (no user cookie)
  '/api/cron/',            // CRON_SECRET-gated jobs
  '/api/geo',              // used by the public marketing site
  '/api/popup-ad',         // used by the public marketing site
  '/api/fx',               // harmless cached currency rate (sanitised input)
]
const isPublicApi = (p: string) => PUBLIC_API.some(a => p === a || p.startsWith(a))

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected  = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isAuthPage   = AUTH_ONLY.some(p => pathname === p || pathname.startsWith(p))
  const isApi        = pathname.startsWith('/api/')

  const accessToken  = req.cookies.get(ACCESS_TOKEN_NAME)?.value
  const refreshToken = req.cookies.get(REFRESH_TOKEN_NAME)?.value

  // Determine if authenticated
  let isAuthed = false
  if (accessToken) {
    const user = await verifyAccessToken(accessToken)
    if (user) isAuthed = true
  }
  if (!isAuthed && refreshToken) {
    const payload = await verifyRefreshToken(refreshToken)
    if (payload?.sub) isAuthed = true
  }

  // Login-gate every non-public API route. The route handler still runs the full
  // getCurrentUser() (which can refresh an expired access token); this is just a
  // cheap front door that rejects anonymous callers with JSON, not a redirect.
  if (isApi) {
    if (!isPublicApi(pathname) && !isAuthed) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Redirect unauthenticated users away from protected routes
  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthPage && isAuthed) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ],
}
