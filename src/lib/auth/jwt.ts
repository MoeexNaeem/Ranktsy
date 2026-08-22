import { SignJWT, jwtVerify } from 'jose'
import type { AuthUser } from '@/types'

/**
 * Auth secrets are REQUIRED - never fall back to a shared/public string in a
 * deployed build. A guessable signing key means anyone can forge a session
 * (including an admin one). In production a missing secret is a hard boot error;
 * only local development is allowed a clearly-marked throwaway default.
 */
function requireSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET', devFallback: string): Uint8Array {
  const val = process.env[name]
  if (val && val.length >= 32) return new TextEncoder().encode(val)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is not set (or is shorter than 32 chars). Refusing to start with an insecure auth secret.`)
  }
  return new TextEncoder().encode(devFallback)
}

const SECRET         = requireSecret('JWT_SECRET',         'dev-secret-change-in-production-min-32-chars')
const REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production-min-32')

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(SECRET)
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(REFRESH_SECRET)
}

export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AuthUser
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET)
    return payload as { sub: string }
  } catch {
    return null
  }
}
