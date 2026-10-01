import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { appUrl } from '@/lib/etsy-oauth'
import { canUseGoogleAdsManager, buildAdsAuthorizeUrl, newOAuthState, ADS_STATE_COOKIE } from '@/lib/google-ads-user'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'
const IS_PROD = process.env.NODE_ENV === 'production'

// Starts "Connect Google Ads": sends the signed-in user to Google's consent screen
// for the adwords scope. Public in the proxy so a logged-out click lands on login.
async function handleGET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(appUrl('/login?redirect=/dashboard?tab=googleads', req.url))
  if (!canUseGoogleAdsManager(user)) return NextResponse.redirect(appUrl('/dashboard?tab=googleads&gads=unavailable', req.url))

  const state = newOAuthState()
  const res = NextResponse.redirect(buildAdsAuthorizeUrl(req.url, state))
  res.cookies.set(ADS_STATE_COOKIE, `${state}.${user.id}`, { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/', maxAge: 600 })
  return res
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
