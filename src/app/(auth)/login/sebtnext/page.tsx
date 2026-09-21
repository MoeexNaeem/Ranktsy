import { AuthForm } from '@/components/auth/AuthForm'
import { SebtClosed } from '@/components/auth/SebtClosed'
import { providerEnabled } from '@/lib/auth/oauth'
import { getSebtConfig } from '@/lib/sebt'

// Clean vanity login for returning SEBT NEXT students: /login/sebtnext renders the
// SEBT-branded login (matches /register/sebtnext). No plan grant here; the grant
// happens once, at signup. Closes with the batch window.
export const metadata = { title: 'SEBT Login - Rankkw' }
export const dynamic = 'force-dynamic'

export default async function SebtLoginPage() {
  const cfg = await getSebtConfig()
  if (!cfg.registrationOpen) return <SebtClosed batch={cfg.batch} />
  const providers = { google: providerEnabled('google'), microsoft: providerEnabled('microsoft') }
  return <AuthForm type="login" providers={providers} cohort="sebt" />
}
