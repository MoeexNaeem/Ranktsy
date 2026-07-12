import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createPkce, randomState, buildAuthorizeUrl, getRedirectUri } from '@/lib/etsy-oauth'

export const runtime = 'nodejs'

const IS_PROD = process.env.NODE_ENV === 'production'
const cookieOpts = { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const, path: '/', maxAge: 600 }

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login?redirect=/dashboard', req.url))
  }
  if (!process.env.ETSY_API_KEY) {
    return NextResponse.redirect(new URL('/dashboard?etsy=misconfigured', req.url))
  }

  const { verifier, challenge } = createPkce()
  const state = randomState()
  const redirectUri = getRedirectUri(req.url)

  const authorizeUrl = buildAuthorizeUrl({ redirectUri, state, challenge })
  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set('etsy_oauth_state', state, cookieOpts)
  res.cookies.set('etsy_oauth_verifier', verifier, cookieOpts)
  return res
}
