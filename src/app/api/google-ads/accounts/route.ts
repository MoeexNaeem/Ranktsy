import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { GoogleAdsConnection } from '@/lib/models'
import { canUseGoogleAdsManager, userAccessToken, discoverAccounts, getConnectionView, adsErrorResponse } from '@/lib/google-ads-user'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'

// POST: re-scan which Google Ads accounts the connected login can reach
// (e.g. after the user was added to a new account).
async function handlePOST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!canUseGoogleAdsManager(user)) return NextResponse.json({ success: false, error: 'Google Ads management is not available for this account yet.' }, { status: 403 })
  try {
    const accounts = await discoverAccounts(await userAccessToken(user.id))
    await connectDB()
    const current = await GoogleAdsConnection.findOne({ userId: user.id }).lean<{ selectedCustomerId: string | null } | null>()
    const stillThere = !!current?.selectedCustomerId && accounts.some(a => a.customerId === current.selectedCustomerId)
    await GoogleAdsConnection.updateOne({ userId: user.id }, {
      $set: { accounts, selectedCustomerId: stillThere ? current!.selectedCustomerId : accounts.length === 1 ? accounts[0].customerId : null },
    })
    return NextResponse.json({ success: true, data: { enabled: true, ...(await getConnectionView(user.id)) } })
  } catch (e) {
    const r = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: r.error, code: r.code }, { status: r.status })
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const POST = withUsage(handlePOST)
