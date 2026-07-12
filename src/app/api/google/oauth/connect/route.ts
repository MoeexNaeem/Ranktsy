import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'
const IS_PROD = process.env.NODE_ENV === 'production'

function redirectUri(reqUrl: string) {
  return process.env.GOOGLE_ADS_REDIRECT_URI || `${new URL(reqUrl).origin}/api/google/oauth/callback`
}

/**
 * One-time helper: sends an admin through Google's consent screen with offline
 * access so we can mint a GOOGLE_ADS_REFRESH_TOKEN. Register the callback URL in
 * your Google Cloud OAuth client's "Authorized redirect URIs" first.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL('/login?redirect=/profile', req.url))
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admins only — this mints an API credential.' }, { status: 403 })
  }
  if (!process.env.GOOGLE_ADS_CLIENT_ID) {
    return NextResponse.json({ success: false, error: 'Set GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET first.' }, { status: 400 })
  }

  const state = crypto.randomBytes(16).toString('hex')
  const p = new URLSearchParams({
    client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
    redirect_uri:  redirectUri(req.url),
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/adwords',
    access_type:   'offline',
    prompt:        'consent',           // force a refresh_token every time
    state,
  })
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`)
  res.cookies.set('gads_oauth_state', state, { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/', maxAge: 600 })
  return res
}
