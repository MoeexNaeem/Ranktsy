import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { appUrl } from '@/lib/etsy-oauth'
import {
  canUseGoogleAdsManager, exchangeAdsCode, emailFromIdToken, discoverAccounts, saveConnection, ADS_STATE_COOKIE, ADS_SCOPES,
} from '@/lib/google-ads-user'
import { GoogleAdsError } from '@/lib/google-ads'

export const runtime = 'nodejs'

// Google redirects here after consent. Stores the (encrypted) refresh token and the
// Google Ads accounts this login can reach, then returns to the Google Ads tab.
export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(appUrl(`/dashboard?tab=googleads&gads=${q}`, req.url))
    res.cookies.delete(ADS_STATE_COOKIE)
    return res
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(appUrl('/login?redirect=/dashboard?tab=googleads', req.url))
  if (!canUseGoogleAdsManager(user)) return back('unavailable')

  const { searchParams } = new URL(req.url)
  if (searchParams.get('error')) return back('denied')

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookie = req.cookies.get(ADS_STATE_COOKIE)?.value ?? ''
  const [cookieState, cookieUser] = cookie.split('.')
  if (!code || !state || state !== cookieState || cookieUser !== user.id) return back('state')

  // The user can untick the Google Ads permission on the consent screen.
  const granted = (searchParams.get('scope') ?? '').split(' ').filter(Boolean)
  if (granted.length && !granted.includes(ADS_SCOPES[0])) return back('scope')

  try {
    const tokens = await exchangeAdsCode(req.url, code)
    if (!tokens.refresh_token) return back('norefresh')
    const accounts = await discoverAccounts(tokens.access_token)
    await saveConnection(user.id, tokens.refresh_token, emailFromIdToken(tokens.id_token), accounts)
    return back(accounts.length ? 'connected' : 'noaccounts')
  } catch (e) {
    // Every failure here used to come back as a single generic "something went
    // wrong", which made the common cases (a Google login with no Ads account,
    // or our own daily quota lock) indistinguishable from a real bug and left
    // the only explanation in the server log. Classify them instead.
    console.error('[GoogleAds connect] callback failed:', e)
    return back(classify(e))
  }
}

/** Map a callback failure to a reason the user can act on. */
function classify(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)

  // Google tells us plainly when the Google account simply isn't a Google Ads
  // user. That is a normal thing for an Etsy seller, not an error on our side.
  if (/NOT_ADS_USER|not associated with any Google Ads account|no Google Ads account/i.test(msg)) return 'notadsuser'

  if (e instanceof GoogleAdsError) {
    if (e.kind === 'quota') return 'quota'
    if (e.kind === 'rate') return 'busy'
    // The developer token or this login is not allowed to reach the Ads API.
    if (/DEVELOPER_TOKEN|CUSTOMER_NOT_ENABLED|USER_PERMISSION_DENIED|PERMISSION_DENIED/i.test(msg)) return 'noaccess'
    if (e.kind === 'auth') return 'noaccess'
  }

  // Token exchange problems (wrong client secret, reused or expired code).
  if (/invalid_client|unauthorized_client/i.test(msg)) return 'appconfig'
  if (/invalid_grant|redirect_uri_mismatch/i.test(msg)) return 'state'

  return 'failed'
}
