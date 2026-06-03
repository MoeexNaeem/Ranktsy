import { cookies } from 'next/headers'

export const ACCESS_TOKEN_NAME  = 'sr_access'
export const REFRESH_TOKEN_NAME = 'sr_refresh'

const IS_PROD = process.env.NODE_ENV === 'production'

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
