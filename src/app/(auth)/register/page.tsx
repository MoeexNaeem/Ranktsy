import { AuthForm } from '@/components/auth/AuthForm'
import { providerEnabled } from '@/lib/auth/oauth'

export const metadata = { title: 'Create account - Rankkw' }
// Render per-request so the OAuth buttons reflect runtime env, not a build snapshot.
export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  const providers = { google: providerEnabled('google'), microsoft: providerEnabled('microsoft') }
  return <AuthForm type="register" providers={providers} />
}
