import { verifyAccessToken, verifyRefreshToken, signAccessToken, signRefreshToken } from './jwt'
import { getAccessToken, getRefreshToken, setAuthCookies } from './cookies'
import { resolveRole } from './roles'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import type { AuthUser } from '@/types'

/**
 * Get the current user from cookies.
 * If access token is expired, attempts refresh using the refresh token.
 * Returns null if both tokens are invalid/missing.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const accessToken = await getAccessToken()

  if (accessToken) {
    const user = await verifyAccessToken(accessToken)
    if (user) return user
  }

  // Try refresh
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return null

  const payload = await verifyRefreshToken(refreshToken)
  if (!payload?.sub) return null

  try {
    await connectDB()
    const dbUser = await User.findById(payload.sub).lean()
    if (!dbUser) return null

    const authUser: AuthUser = {
      id:         dbUser._id.toString(),
      name:       dbUser.name,
      email:      dbUser.email,
      role:       resolveRole(dbUser.email, dbUser.role),
      plan:       dbUser.plan,
      isVerified: dbUser.isVerified,
      etsyShopId: dbUser.etsyShopId,
    }

    // Issue new tokens silently
    const [newAccess, newRefresh] = await Promise.all([
      signAccessToken(authUser),
      signRefreshToken(authUser.id),
    ])
    await setAuthCookies(newAccess, newRefresh)

    return authUser
  } catch {
    return null
  }
}
