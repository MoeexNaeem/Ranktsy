import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { refundLastCharge, isCreditTool } from '@/lib/credits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Reverse the caller's most recent charge for `tool`.
 *
 * The server charges once it has produced a good answer, which is the furthest it
 * can see. When the answer then fails to reach the user - the request was aborted,
 * the connection dropped, the view threw while rendering - the client reports it
 * here and the charge is undone, so an error on EITHER side costs nothing.
 *
 * Only the caller's own last charge can be reversed, only within a two-minute
 * window, and only once (the update is guarded on `refunded: false`). So the worst
 * a misbehaving client achieves is declining to be charged for its own searches,
 * which the hourly search gate already bounds.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tool = String(body?.tool ?? '').trim()
  if (!isCreditTool(tool)) {
    return NextResponse.json({ success: false, error: 'Unknown tool.' }, { status: 400 })
  }

  await connectDB()
  const state = await refundLastCharge(auth.id, tool)

  // Nothing to reverse is a normal outcome, not a failure: the charge may have
  // already been refunded, or fallen outside the window.
  return NextResponse.json({ success: true, refunded: !!state, state: state ?? undefined })
}
