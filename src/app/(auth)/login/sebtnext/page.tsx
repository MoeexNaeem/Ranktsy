import { AuthForm } from '@/components/auth/AuthForm'
import { providerEnabled } from '@/lib/auth/oauth'

// Clean vanity login for returning SEBT NEXT students: /login/sebtnext renders the
// SEBT-branded login (matches /register/sebtnext). No plan grant here; the grant
// happens once, at signup.
export const metadata = { title: 'SEBT Login - Rankkw' }
export const dynamic = 'force-dynamic'

export default function SebtLoginPage() {
  const providers = { google: providerEnabled('google'), microsoft: providerEnabled('microsoft') }
  return <AuthForm type="login" providers={providers} cohort="sebt" />
}
