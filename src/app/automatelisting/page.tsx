import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { AutomateClient } from '@/components/automation/AutomateClient'

// HIDDEN feature — direct-URL only, admin-gated, not indexed, not in any nav.
// Non-admins (and logged-out visitors) get a 404 so the page's existence isn't
// revealed. Flip the gate later to open it to a paid plan.
export const metadata: Metadata = {
  title: 'Automate Etsy Shop',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function AutomateListingPage() {
  const user = await getCurrentUser().catch(() => null)
  if (!user || !isAdmin(user)) notFound()
  return <AutomateClient />
}
