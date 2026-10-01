import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { getMaintenance, setMaintenance, type MaintenanceState } from '@/lib/maintenance'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Admin maintenance-mode switch.
 *   GET                         current state
 *   POST { on, message? }       turn on/off (applies to every worker within ~5s)
 */
async function requireAdmin() {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), user: null }
  if (!isAdmin(user)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), user: null }
  return { error: null, user }
}

export async function GET(): Promise<NextResponse<ApiResponse<MaintenanceState>>> {
  const g = await requireAdmin(); if (g.error) return g.error
  return NextResponse.json({ success: true, data: await getMaintenance() })
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<MaintenanceState>>> {
  const g = await requireAdmin(); if (g.error) return g.error
  const body = await req.json().catch(() => ({}))
  if (typeof body?.on !== 'boolean') return NextResponse.json({ success: false, error: 'Send { on: true | false }.' }, { status: 400 })
  try {
    const state = await setMaintenance(body.on, typeof body.message === 'string' ? body.message : undefined, g.user!.email)
    console.warn(`[maintenance] ${state.on ? 'ON' : 'OFF'} by ${g.user!.email}`)
    return NextResponse.json({ success: true, data: state })
  } catch (e) {
    console.error('[maintenance] toggle failed:', e)
    return NextResponse.json({ success: false, error: 'Could not change maintenance mode. Please try again.' }, { status: 500 })
  }
}
