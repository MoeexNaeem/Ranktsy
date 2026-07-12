import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import { clearEtsyTokens } from '@/lib/etsy-tokens'
import type { AuthUser } from '@/types'

export const runtime = 'nodejs'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await clearEtsyTokens(user.id)

  // Refresh the session so the disconnected state is reflected immediately.
  const authUser: AuthUser = { ...user, etsyShopId: undefined }
  const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(user.id)])
  await setAuthCookies(at, rt)

  return NextResponse.json({ success: true })
}
