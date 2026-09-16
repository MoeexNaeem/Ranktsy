import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { GoogleAdsConnection } from '@/lib/models'
import { canUseGoogleAdsManager, getConnectionView, disconnect, adsErrorResponse } from '@/lib/google-ads-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: is Google Ads management available to this user, and what's connected.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!canUseGoogleAdsManager(user)) return NextResponse.json({ success: true, data: { enabled: false } })
  try {
    return NextResponse.json({ success: true, data: { enabled: true, ...(await getConnectionView(user.id)) } })
  } catch (e) {
    const r = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: r.error }, { status: r.status })
  }
}

// PATCH { customerId }: choose which connected account the campaign tools act on.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!canUseGoogleAdsManager(user)) return NextResponse.json({ success: false, error: 'Google Ads management is not available for this account yet.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const customerId = String(body.customerId ?? '').replace(/\D/g, '')
  await connectDB()
  const res = await GoogleAdsConnection.updateOne(
    { userId: user.id, 'accounts.customerId': customerId },
    { $set: { selectedCustomerId: customerId } },
  )
  if (!res.matchedCount) return NextResponse.json({ success: false, error: 'That account is not linked to your Google login.' }, { status: 404 })
  return NextResponse.json({ success: true, data: { enabled: true, ...(await getConnectionView(user.id)) } })
}

// DELETE: disconnect Google Ads (revokes the grant at Google and deletes the stored token).
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  await disconnect(user.id)
  return NextResponse.json({ success: true })
}
