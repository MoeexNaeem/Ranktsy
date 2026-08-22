import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  // `restricted` is deliberately NOT baked into the JWT (same lesson as the old
  // etsyShopId bug) - an admin restricting someone should take effect on their
  // very next dashboard load, not wait out a 15-minute access token.
  await connectDB()
  const dbUser = await User.findById(user.id).select('restricted').lean()

  return NextResponse.json({ success: true, data: { ...user, restricted: !!dbUser?.restricted } })
}
