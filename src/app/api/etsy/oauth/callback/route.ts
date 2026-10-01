import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { exchangeCodeForToken, getRedirectUri, userIdFromToken, appUrl } from '@/lib/etsy-oauth'
import { getShopByOwner } from '@/lib/etsy'
import { saveEtsyTokens } from '@/lib/etsy-tokens'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'

function back(req: NextRequest, params: string) {
  const res = NextResponse.redirect(appUrl(`/dashboard?${params}`, req.url))
  // Always clear the short-lived PKCE cookies.
  res.cookies.delete('etsy_oauth_state')
  res.cookies.delete('etsy_oauth_verifier')
  return res
}

async function handleGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) return back(req, `etsy=denied`)

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(appUrl('/login?redirect=/dashboard', req.url))

  const cookieState = req.cookies.get('etsy_oauth_state')?.value
  const verifier    = req.cookies.get('etsy_oauth_verifier')?.value
  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return back(req, 'etsy=state_mismatch')
  }

  try {
    const redirectUri = getRedirectUri(req.url)
    const tokens = await exchangeCodeForToken({ code, verifier, redirectUri })

    const etsyUserId = userIdFromToken(tokens.access_token)
    // The shop lookup spends one call on the primary Etsy key. When the shared API
    // quota is tight or Etsy blips, one attempt used to fail the WHOLE connection and
    // the user only saw the connect button again. Retry briefly, and if Etsy is still
    // throttling, tell them it is busy rather than "error".
    let shop: Awaited<ReturnType<typeof getShopByOwner>> | null = null
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 3 && !shop; attempt++) {
      try { shop = await getShopByOwner(tokens.access_token, etsyUserId) }
      catch (e) {
        lastErr = e
        const msg = e instanceof Error ? e.message : ''
        if (!/\b(429|5\d\d)\b/.test(msg)) break   // a real error: don't retry
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)))
      }
    }
    if (!shop) {
      console.error('[Etsy OAuth] shop lookup failed:', lastErr)
      const msg = lastErr instanceof Error ? lastErr.message : ''
      return back(req, /\b(429|5\d\d)\b/.test(msg) ? 'etsy=busy' : 'etsy=error')
    }
    if (!shop.shop_id) return back(req, 'etsy=no_shop')

    // Upserts by (userId, shopId) - connecting this shop never disturbs any
    // other shop the user already connected. Stored in its own collection, not
    // the session, so it survives logout and only goes away on disconnect.
    await saveEtsyTokens(user.id, tokens, shop.shop_id, shop.shop_name)

    return back(req, 'etsy=connected')
  } catch (err) {
    console.error('[Etsy OAuth] callback failed:', err)
    return back(req, 'etsy=error')
  }
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
