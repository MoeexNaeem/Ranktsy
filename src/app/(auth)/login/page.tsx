import { AuthForm } from '@/components/auth/AuthForm'
import { providerEnabled } from '@/lib/auth/oauth'

export const metadata = { title: 'Log in — Rankkw' }
// Render per-request so the OAuth buttons reflect runtime env, not a build snapshot.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const providers = { google: providerEnabled('google'), microsoft: providerEnabled('microsoft') }
  return <AuthForm type="login" providers={providers} />
}
