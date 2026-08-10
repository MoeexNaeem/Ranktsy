import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { getCreditState } from '@/lib/credits'

// The signed-in user's current daily credit balance — read fresh from the DB
// (reflects a just-purchased upgrade or a midnight reset). Powers the dashboard
// top-bar credits pill.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const state = await getCreditState(auth.id)
  if (!state) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  return NextResponse.json({ success: true, state })
}
