import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { hashPassword } from '@/lib/auth/password'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setAuthCookiesOn } from '@/lib/auth/cookies'
import { resolveRole } from '@/lib/auth/roles'
import { isOAuthProvider, providerEnabled, exchangeCodeForProfile } from '@/lib/auth/oauth'
import { isAllowedEmailDomain } from '@/lib/auth/schemas'
import { siteUrl } from '@/lib/seo/site'
import type { AuthUser } from '@/types'

// OAuth callback: verify state, exchange the code, find-or-create the user, then
// issue the same JWT session cookies the password flow uses.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const fail = (base: string, code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, base))

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const base = siteUrl()

  if (!isOAuthProvider(provider) || !providerEnabled(provider)) return fail(base, 'oauth_unavailable')

  const sp = req.nextUrl.searchParams
  if (sp.get('error')) return fail(base, 'oauth_denied')

  const code = sp.get('code')
  const state = sp.get('state')
  const cookieState = req.cookies.get('oauth_state')?.value
  if (!code || !state || !cookieState || state !== cookieState) return fail(base, 'oauth_state')

  try {
    const profile = await exchangeCodeForProfile(provider, code)
    if (!profile) return fail(base, 'oauth_failed')

    await connectDB()
    let user = await User.findOne({ email: profile.email })

    // New accounts must use an allowed provider domain. Existing users are exempt.
    if (!user && !isAllowedEmailDomain(profile.email)) {
      return NextResponse.redirect(new URL('/register?error=oauth_domain', base))
    }

    if (!user) {
      // No password is known - store an unguessable placeholder so the account
      // can only be entered via the provider (or a password reset).
      const placeholder = await hashPassword(`${globalThis.crypto.randomUUID()}${globalThis.crypto.randomUUID()}`)
      user = await User.create({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        password: placeholder,
        role: resolveRole(profile.email),
        isVerified: true,           // email is verified by the provider
        authProvider: provider,
      })
    } else if (!user.authProvider) {
      // First social login on an existing email/password account - link them.
      user.authProvider = provider
      await user.save()
    }

    const authUser: AuthUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: resolveRole(user.email, user.role),
      plan: user.plan,
      isVerified: user.isVerified,
    }
    const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(authUser.id)])

    const rawDest = req.cookies.get('oauth_redirect')?.value || '/dashboard'
    const dest = rawDest.startsWith('/') && !rawDest.startsWith('//') ? rawDest : '/dashboard'

    const res = NextResponse.redirect(new URL(dest, base))
    setAuthCookiesOn(res, at, rt)
    res.cookies.delete('oauth_state')
    res.cookies.delete('oauth_redirect')
    return res
  } catch (err) {
    console.error('[oauth callback]', provider, err)
    return fail(base, 'oauth_failed')
  }
}
