import type { Metadata } from 'next'
import { AutomateEditor } from '@/components/automation/AutomateEditor'

// HIDDEN feature — direct-URL only, not in any nav or sitemap, not indexed.
// The page (the visual builder) is open so it can be used/tested, but the
// automation APIs (/api/automation/*) stay owner-gated, so a stranger who finds
// the URL sees only a non-functional canvas (Execute returns 403).
export const metadata: Metadata = {
  title: 'Automate Etsy Shop',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default function AutomateListingPage() {
  return <AutomateEditor />
}
