import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'

export const runtime = 'nodejs'

// The user closed the "your plan expired" popup: don't show it again for this expiry.
export async function POST() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  await connectDB()
  await User.updateOne({ _id: auth.id }, { $set: { planExpiryNoticeSeen: true } })
  return NextResponse.json({ success: true })
}
