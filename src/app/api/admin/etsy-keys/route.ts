import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { etsyKeyIds } from '@/lib/etsy'
import { readEtsyKeySwitch, setEtsyKeyEnabled, EtsyKeySwitchError } from '@/lib/etsy-key-switch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin on/off switch for each Etsy API key (Code Flow → Etsy API quota).
 *   GET  → [{ index, id, enabled }] + who changed it last
 *   POST { id, enabled } → saves it; every worker follows within ~5 seconds.
 * A key that is OFF gets no public calls, so its daily quota recovers while the
 * other keys carry the load. The last key that is on can't be switched off.
 */
async function requireAdmin() {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), user: null }
  if (!isAdmin(user)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), user: null }
  return { error: null, user }
}

function payload(ids: string[], state: { disabled: string[]; by: string | null; at: string | null }) {
  return {
    keys: ids.map((id, i) => ({ index: i + 1, id, enabled: !state.disabled.includes(id) })),
    by: state.by,
    at: state.at,
  }
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error
  const state = await readEtsyKeySwitch()
  return NextResponse.json({ success: true, data: payload(etsyKeyIds(), state) })
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAdmin()
  if (error || !user) return error

  const body = await req.json().catch(() => null) as { id?: unknown; enabled?: unknown } | null
  if (!body || typeof body.id !== 'string' || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Send { id, enabled }.' }, { status: 400 })
  }
  const ids = etsyKeyIds()
  try {
    const state = await setEtsyKeyEnabled(body.id, body.enabled, user.email, ids)
    console.log(`[Etsy] admin ${user.email} switched key #${ids.indexOf(body.id) + 1} ${body.enabled ? 'ON' : 'OFF'} (${ids.length - state.disabled.length}/${ids.length} keys on)`)
    return NextResponse.json({ success: true, data: payload(ids, state) })
  } catch (e) {
    if (e instanceof EtsyKeySwitchError) return NextResponse.json({ success: false, error: e.message }, { status: 400 })
    return NextResponse.json({ success: false, error: 'Could not save. Please try again.' }, { status: 500 })
  }
}
