import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, verifyRefreshToken } from '@/lib/auth/jwt'
import { ACCESS_TOKEN_NAME, REFRESH_TOKEN_NAME } from '@/lib/auth/cookies'
import { resolveRole } from '@/lib/auth/roles'
import { getMaintenance, isAdminUserId } from '@/lib/maintenance'
import { maintenanceHtml } from '@/lib/maintenance-html'

// Next 16 renamed "middleware" to "proxy" (same functionality, Node.js runtime by
// default). This runs before a request completes: maintenance mode, then the
// login gate for the API surface, then auth/protected page redirects.

const PROTECTED = ['/dashboard', '/profile', '/admin', '/local-payment']
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
  '/api/google-ads/connect', // user "Connect Google Ads" + callback (handle their own login redirect)
  '/api/lemonsqueezy/webhook', // signed server-to-server webhook (no user cookie)
  '/api/cron/',            // CRON_SECRET-gated jobs
  '/api/geo',              // used by the public marketing site
  '/api/popup-ad',         // used by the public marketing site
  '/api/affiliate/click',  // anonymous referral-click tracking (sets the ?ref cookie)
  '/api/etsy/estimate-config', // static model constants the extension loads at startup
  '/api/fx',               // harmless cached currency rate (sanitised input)
  '/api/health',           // uptime / load-balancer health probe
  '/api/mcp',              // public MCP server (agents connect without a session)
]
const isPublicApi = (p: string) => PUBLIC_API.some(a => p === a || p.startsWith(a))

/**
 * Still reachable for EVERYONE while maintenance mode is on: the maintenance page
 * itself, login (so an admin can sign in), the auth API, the health probe, the
 * payment webhook (sales must keep landing), and the plan-expiry cron. The
 * Etsy-spending crons (snapshot, keyword-alerts) are deliberately NOT here, so
 * they pause and the quota can recover.
 */
// /api/realtime/stream handles maintenance itself (an idle stream, so open tabs stop
// reconnecting every few seconds; see the route).
const MAINTENANCE_OPEN = ['/maintenance', '/login', '/api/auth/', '/api/health', '/api/lemonsqueezy/webhook', '/api/cron/plan-expiry', '/api/realtime/stream']
const isMaintenanceOpen = (p: string) => MAINTENANCE_OPEN.some(a => {
  const base = a.replace(/\/$/, '')
  return p === base || p.startsWith(base + '/')
})

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected  = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isAuthPage   = AUTH_ONLY.some(p => pathname === p || pathname.startsWith(p))
  const isApi        = pathname.startsWith('/api/')

  const accessToken  = req.cookies.get(ACCESS_TOKEN_NAME)?.value
  const refreshToken = req.cookies.get(REFRESH_TOKEN_NAME)?.value

  // Who is calling. Lazy: public marketing pages (now also matched, for
  // maintenance) must not pay for JWT verification when nothing needs it.
  let session: { authed: boolean; admin: boolean } | null = null
  const getSession = async () => {
    if (session) return session
    let authed = false, admin = false
    const user = accessToken ? await verifyAccessToken(accessToken) : null
    if (user) {
      authed = true
      admin = !!user.email && resolveRole(user.email, user.role) === 'admin'
    } else if (refreshToken) {
      const payload = await verifyRefreshToken(refreshToken)
      if (payload?.sub) { authed = true; admin = false }
    }
    session = { authed, admin }
    return session
  }

  // ── Maintenance mode: the site is closed to everyone but admins ──
  if (!isMaintenanceOpen(pathname)) {
    const m = await getMaintenance()
    if (m.on) {
      const s = await getSession()
      let admin = s.admin
      // Access token expired but a refresh token is present: look the role up.
      if (!admin && s.authed && !accessToken && refreshToken) {
        const payload = await verifyRefreshToken(refreshToken)
        if (payload?.sub) admin = await isAdminUserId(payload.sub)
      }
      if (!admin) {
        const headers = { 'Retry-After': '3600', 'Cache-Control': 'no-store' }
        if (isApi) {
          return NextResponse.json(
            { success: false, code: 'maintenance', error: m.message },
            { status: 503, headers },
          )
        }
        // A fixed HTML page straight from here (no React render per request): the
        // visitor's URL stays put, so when maintenance ends a refresh lands them
        // back where they were. 503 + Retry-After = temporary for search engines.
        return new NextResponse(maintenanceHtml(m.message), {
          status: 503,
          headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
    }
  }

  // Pages outside the auth flow need nothing more.
  if (!isApi && !isProtected && !isAuthPage) return NextResponse.next()

  const { authed: isAuthed } = await getSession()

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
    // Keep the query (e.g. /dashboard?tab=notifications) so deep links survive login.
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('redirect', pathname + req.nextUrl.search)
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
  // Every route except Next's static assets and plain files (images, robots.txt,
  // sitemaps, llms.txt...), so maintenance mode can cover the whole site.
  // All of /_next/ is framework-internal (static chunks, images, dev live-reload),
  // so none of it goes through the gate.
  matcher: ['/((?!_next/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)'],
}
