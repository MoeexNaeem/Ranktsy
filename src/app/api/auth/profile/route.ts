import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { resolveRole } from '@/lib/auth/roles'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import type { AuthUser } from '@/types'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const u = await User.findById(auth.id).lean()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  const searches = await KeywordHistory.countDocuments({ userId: auth.id })

  return NextResponse.json({
    success: true,
    data: {
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: resolveRole(u.email, u.role),
      plan: u.plan,
      isVerified: u.isVerified,
      etsyShopId: u.etsyShopId ?? null,
      savedKeywords: (u.savedKeywords ?? []).length,
      searches,
      createdAt: u.createdAt ?? null,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim()
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ success: false, errors: { name: 'Name must be 2–60 characters' } }, { status: 422 })
  }

  await connectDB()
  const u = await User.findByIdAndUpdate(auth.id, { name }, { new: true }).lean()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  // Re-issue tokens so the session (and header badge) reflect the new name immediately.
  const authUser: AuthUser = { id: auth.id, name, email: u.email, role: resolveRole(u.email, u.role), plan: u.plan, isVerified: u.isVerified, etsyShopId: u.etsyShopId }
  const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(auth.id)])
  await setAuthCookies(at, rt)

  return NextResponse.json({ success: true, data: { name } })
}
