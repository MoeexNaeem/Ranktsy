import type { Metadata } from 'next'
import { AutomateEditor } from '@/components/automation/AutomateEditor'
import { AutomateComingSoon } from '@/components/automation/AutomateComingSoon'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

// Admin-only for now: admins get the visual builder, everyone else (logged in or
// not) sees "Coming soon". The /api/automation/* routes enforce the same gate
// (lib/automation/guard.ts). Not indexed.
export const metadata: Metadata = {
  title: 'Automate Listing',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function AutomateListingPage() {
  const user = await getCurrentUser().catch(() => null)
  if (!isAdmin(user)) return <AutomateComingSoon />
  return <AutomateEditor />
}
