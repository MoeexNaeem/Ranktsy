import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { activeBonus } from '@/lib/credits'
import { notifyUser } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin bonus credits for one user.
 *
 *   POST   { credits, days }  grant extra credits valid for `days` days
 *   DELETE                    remove the bonus pool now
 *
 * A bonus is a ONE-TIME pool on top of the plan: it does not reset daily, is spent
 * only after the day's plan credits run out, and stops counting the moment it
 * expires (the user is simply back on their plan, nothing else changes). Granting
 * again while a pool is still valid tops it up and sets the new expiry.
 */
const MAX_CREDITS = 100_000
const MAX_DAYS = 365

async function requireAdmin() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  return null
}

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin(); if (denied) return denied
  const { id } = await params
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const credits = Math.floor(Number(body?.credits))
  const days = Math.floor(Number(body?.days))
  if (!Number.isFinite(credits) || credits < 1 || credits > MAX_CREDITS) {
    return NextResponse.json({ success: false, error: `Credits must be between 1 and ${MAX_CREDITS.toLocaleString('en-US')}.` }, { status: 400 })
  }
  if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json({ success: false, error: `Days must be between 1 and ${MAX_DAYS}.` }, { status: 400 })
  }

  await connectDB()
  const user = await User.findById(id).select('bonusCredits bonusCreditsGranted bonusExpiresAt')
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  const now = new Date()
  const current = activeBonus(user, now)
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  // Still-valid pool: top it up. Expired or none: start a fresh pool (an expired
  // remainder is worthless and must not come back to life).
  user.bonusCredits = (current?.remaining ?? 0) + credits
  user.bonusCreditsGranted = (current?.granted ?? 0) + credits
  user.bonusGrantedAt = current ? (user.bonusGrantedAt ?? now) : now
  user.bonusExpiresAt = expiresAt
  await user.save()

  const until = expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  void notifyUser(id, `You received ${credits.toLocaleString('en-US')} bonus credits`,
    `They are on top of your plan and valid until ${until}. Your plan's daily credits are used first.`, '/dashboard', 'success')

  return NextResponse.json({ success: true, data: { bonus: activeBonus(user, now) } })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin(); if (denied) return denied
  const { id } = await params
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 })

  await connectDB()
  const r = await User.updateOne({ _id: id }, { $set: { bonusCredits: 0, bonusCreditsGranted: 0, bonusGrantedAt: null, bonusExpiresAt: null } })
  if (!r.matchedCount) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: { bonus: null } })
}
