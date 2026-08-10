import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory, ConnectedShop, TrackedShop } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { clearAuthCookies } from '@/lib/auth/cookies'

export const runtime = 'nodejs'

/** Self-service account deletion — the user removing their OWN account. */
export async function DELETE() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const deleted = await User.findByIdAndDelete(auth.id).lean()
  if (!deleted) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })

  await Promise.all([
    KeywordHistory.deleteMany({ userId: auth.id }).catch(() => {}),
    ConnectedShop.deleteMany({ userId: auth.id }).catch(() => {}),
    TrackedShop.deleteMany({ userId: auth.id }).catch(() => {}),
  ])

  await clearAuthCookies()
  return NextResponse.json({ success: true })
}
