import { AuthForm } from '@/components/auth/AuthForm'
import { SebtClosed } from '@/components/auth/SebtClosed'
import { providerEnabled } from '@/lib/auth/oauth'
import { getSebtConfig } from '@/lib/sebt'

// Clean vanity link for the SEBT NEXT education cohort: /register/sebtnext renders
// the SEBT-branded signup and grants the free Enterprise trial. Same as
// /register?cohort=sebt, but with a shareable, pretty URL. Open/closed and the
// batch number both come from the admin panel (Settings -> SEBT NEXT).
export const metadata = { title: 'SEBT Sign Up - Rankkw' }
export const dynamic = 'force-dynamic'

export default async function SebtRegisterPage() {
  const cfg = await getSebtConfig()
  if (!cfg.registrationOpen) return <SebtClosed batch={cfg.batch} />
  const providers = { google: providerEnabled('google'), microsoft: providerEnabled('microsoft') }
  return <AuthForm type="register" providers={providers} cohort="sebt" />
}
