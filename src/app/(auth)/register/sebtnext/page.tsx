import { AuthForm } from '@/components/auth/AuthForm'
import { SebtClosed } from '@/components/auth/SebtClosed'
import { providerEnabled } from '@/lib/auth/oauth'
import { sebtBatchOpen } from '@/lib/sebt'

// Clean vanity link for the SEBT NEXT education cohort: /register/sebtnext renders
// the SEBT-branded signup and grants the Enterprise plan free for 7 days. Same as
// /register?cohort=sebt, but with a shareable, pretty URL. Closes with the batch.
export const metadata = { title: 'SEBT Sign Up - Rankkw' }
export const dynamic = 'force-dynamic'

export default function SebtRegisterPage() {
  if (!sebtBatchOpen()) return <SebtClosed />
  const providers = { google: providerEnabled('google'), microsoft: providerEnabled('microsoft') }
  return <AuthForm type="register" providers={providers} cohort="sebt" />
}
