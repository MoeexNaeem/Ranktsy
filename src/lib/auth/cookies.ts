import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'

export const ACCESS_TOKEN_NAME  = 'sr_access'
export const REFRESH_TOKEN_NAME = 'sr_refresh'

const IS_PROD = process.env.NODE_ENV === 'production'
const ACCESS_MAXAGE  = 60 * 15            // 15 min
const REFRESH_MAXAGE = 60 * 60 * 24 * 30  // 30 days

/**
 * Set the auth cookies directly on a NextResponse — used by the OAuth callback,
 * which returns a redirect and needs the Set-Cookie headers on that exact
 * response (rather than the ambient cookies() jar).
 */
export function setAuthCookiesOn(res: NextResponse, accessToken: string, refreshToken: string) {
  const base = { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const, path: '/' }
  res.cookies.set(ACCESS_TOKEN_NAME, accessToken, { ...base, maxAge: ACCESS_MAXAGE })
  res.cookies.set(REFRESH_TOKEN_NAME, refreshToken, { ...base, maxAge: REFRESH_MAXAGE })
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies()

  jar.set(ACCESS_TOKEN_NAME, accessToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 15,           // 15 min
  })

  jar.set(REFRESH_TOKEN_NAME, refreshToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 30, // 30 days
  })
}

export async function clearAuthCookies() {
  const jar = await cookies()
  jar.delete(ACCESS_TOKEN_NAME)
  jar.delete(REFRESH_TOKEN_NAME)
}

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies()
  return jar.get(ACCESS_TOKEN_NAME)?.value
}

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies()
  return jar.get(REFRESH_TOKEN_NAME)?.value
}
