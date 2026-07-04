import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, verifyRefreshToken } from '@/lib/auth/jwt'
import { ACCESS_TOKEN_NAME, REFRESH_TOKEN_NAME } from '@/lib/auth/cookies'

const PROTECTED = ['/dashboard', '/profile', '/admin']
const AUTH_ONLY = ['/login', '/register', '/forgot-password', '/reset-password'] // redirect if already logged in

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected  = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isAuthPage   = AUTH_ONLY.some(p => pathname === p || pathname.startsWith(p))

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
    '/dashboard/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ],
}
