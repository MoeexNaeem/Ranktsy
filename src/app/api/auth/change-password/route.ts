import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { comparePassword, hashPassword } from '@/lib/auth/password'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')

  if (!/(?=.*[A-Z])(?=.*\d).{8,}/.test(newPassword)) {
    return NextResponse.json({ success: false, errors: { newPassword: 'Min 8 chars with 1 uppercase and 1 number' } }, { status: 422 })
  }

  await connectDB()
  const u = await User.findById(auth.id).select('+password')
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  const ok = await comparePassword(currentPassword, u.password)
  if (!ok) return NextResponse.json({ success: false, errors: { currentPassword: 'Current password is incorrect' } }, { status: 401 })

  u.password = await hashPassword(newPassword)
  await u.save()

  return NextResponse.json({ success: true, data: { ok: true } })
}
