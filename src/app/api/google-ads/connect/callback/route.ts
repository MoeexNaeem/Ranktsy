import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { appUrl } from '@/lib/etsy-oauth'
import {
  canUseGoogleAdsManager, exchangeAdsCode, emailFromIdToken, discoverAccounts, saveConnection, ADS_STATE_COOKIE, ADS_SCOPES,
} from '@/lib/google-ads-user'

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
    console.error('[GoogleAds connect] callback failed:', e)
    return back('failed')
  }
}
