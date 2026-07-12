import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

function redirectUri(reqUrl: string) {
  return process.env.GOOGLE_ADS_REDIRECT_URI || `${new URL(reqUrl).origin}/api/google/oauth/callback`
}

const page = (title: string, body: string) => new NextResponse(
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
   <style>body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 24px;color:#2a2a2a;line-height:1.6}
   code,textarea{font-family:ui-monospace,monospace}
   .box{background:#f6f5f2;border:1px solid #e5e4e2;border-radius:10px;padding:16px;margin:16px 0}
   textarea{width:100%;height:90px;padding:10px;border:1px solid #dcdcd6;border-radius:8px;font-size:12px;box-sizing:border-box}
   h1{font-weight:600;letter-spacing:-.5px}a{color:#ff6008}</style></head>
   <body>${body}</body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
)

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admins only.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieState = req.cookies.get('gads_oauth_state')?.value
  const err = searchParams.get('error')

  if (err) return page('Google connect failed', `<h1>Google authorization was denied</h1><p>${err}</p>`)
  if (!code || !state || state !== cookieState) {
    return page('Google connect failed', `<h1>State check failed</h1><p>Please retry from <a href="/api/google/oauth/connect">the start</a>.</p>`)
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        redirect_uri:  redirectUri(req.url),
        code,
        grant_type:    'authorization_code',
      }).toString(),
      cache: 'no-store',
    })
    const j = await res.json() as { refresh_token?: string; error?: string; error_description?: string }
    if (!res.ok || !j.refresh_token) {
      return page('No refresh token', `<h1>Couldn't get a refresh token</h1>
        <p>${j.error_description || j.error || 'Google returned no refresh_token. Make sure you used prompt=consent and offline access.'}</p>
        <p><a href="/api/google/oauth/connect">Try again</a></p>`)
    }

    const out = page('Google Ads connected', `
      <h1>✅ Copy your refresh token</h1>
      <p>Add this line to your <code>.env.local</code>, then restart the dev server:</p>
      <div class="box"><textarea readonly onclick="this.select()">GOOGLE_ADS_REFRESH_TOKEN=${j.refresh_token}</textarea></div>
      <p>You also need <code>GOOGLE_ADS_CUSTOMER_ID</code> (your Google Ads account id, 10 digits, no dashes) — and
      <code>GOOGLE_ADS_LOGIN_CUSTOMER_ID</code> if that account sits under a manager (MCC).</p>
      <p>Once set, the Keyword Tool's <strong>Google Searches</strong> column and <strong>Searchers by Country</strong> panel light up automatically.</p>
      <p><a href="/dashboard">← Back to dashboard</a></p>`)
    out.cookies.delete('gads_oauth_state')
    return out
  } catch (e) {
    return page('Google connect error', `<h1>Something went wrong</h1><p>${e instanceof Error ? e.message : 'Unknown error'}</p>`)
  }
}
