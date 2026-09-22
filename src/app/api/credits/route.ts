import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { getCreditState } from '@/lib/credits'
import { peekDailySearch } from '@/lib/quota'

// The signed-in user's daily allowances, read fresh from the DB (so a just-bought
// upgrade or a midnight reset shows at once). Powers both top-bar pills: credits
// for the metered tools, and the separate per-plan keyword-search limit. They are
// deliberately different meters - Keyword Search never costs credits.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const [state, search] = await Promise.all([
    getCreditState(auth.id),
    peekDailySearch(auth.id).catch(() => null),
  ])
  if (!state) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    success: true,
    state: {
      ...state,
      searches: search ? { used: search.used, limit: Number.isFinite(search.limit) ? search.limit : null } : undefined,
    },
  })
}
