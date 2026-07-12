import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { ACCESS_TOKEN_NAME, REFRESH_TOKEN_NAME } from '@/lib/auth/cookies'
import { exchangeCodeForToken, getRedirectUri, userIdFromToken } from '@/lib/etsy-oauth'
import { getShopByOwner } from '@/lib/etsy'
import { saveEtsyTokens } from '@/lib/etsy-tokens'
import type { AuthUser } from '@/types'

export const runtime = 'nodejs'
const IS_PROD = process.env.NODE_ENV === 'production'

function back(req: NextRequest, params: string) {
  const res = NextResponse.redirect(new URL(`/dashboard?${params}`, req.url))
  // Always clear the short-lived PKCE cookies.
  res.cookies.delete('etsy_oauth_state')
  res.cookies.delete('etsy_oauth_verifier')
  return res
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) return back(req, `etsy=denied`)

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL('/login?redirect=/dashboard', req.url))

  const cookieState = req.cookies.get('etsy_oauth_state')?.value
  const verifier    = req.cookies.get('etsy_oauth_verifier')?.value
  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return back(req, 'etsy=state_mismatch')
  }

  try {
    const redirectUri = getRedirectUri(req.url)
    const tokens = await exchangeCodeForToken({ code, verifier, redirectUri })

    const etsyUserId = userIdFromToken(tokens.access_token)
    const shop = await getShopByOwner(tokens.access_token, etsyUserId)
    if (!shop.shop_id) return back(req, 'etsy=no_shop')

    await saveEtsyTokens(user.id, tokens, shop.shop_id)

    // Re-issue the session so user.etsyShopId is immediately visible to the UI.
    const authUser: AuthUser = { ...user, etsyShopId: String(shop.shop_id) }
    const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(user.id)])

    const res = back(req, 'etsy=connected')
    res.cookies.set(ACCESS_TOKEN_NAME, at, { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/', maxAge: 60 * 15 })
    res.cookies.set(REFRESH_TOKEN_NAME, rt, { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    return res
  } catch (err) {
    console.error('[Etsy OAuth] callback failed:', err)
    return back(req, 'etsy=error')
  }
}
