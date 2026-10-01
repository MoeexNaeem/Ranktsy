import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

/**
 * Automate Listing is admin-only for now (everyone else sees "Coming soon").
 * Every /api/automation/* route goes through this so the gate lives in one place:
 * to open it to a plan later, change this check (and app/automatelisting/page.tsx).
 */
export async function requireAutomationUser() {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), user: null }
  if (!isAdmin(user)) return { error: NextResponse.json({ success: false, error: 'Automate Listing is coming soon.' }, { status: 403 }), user: null }
  return { error: null, user }
}
