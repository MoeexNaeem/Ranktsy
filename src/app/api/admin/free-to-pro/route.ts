import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { setFreeToProPromo, convertFreeToPro, isFreeToProPromoOn } from '@/lib/promo'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

async function guard() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { auth }
}

// Toggle the promo (`{ enabled }`) or re-run the conversion for new free users (`{ refresh: true }`).
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ enabled: boolean; affected: number }>>> {
  const g = await guard(); if (g.error) return g.error
  const body = await req.json().catch(() => ({}))

  if (body.refresh) {
    const affected = await convertFreeToPro()
    return NextResponse.json({ success: true, data: { enabled: await isFreeToProPromoOn(), affected } })
  }

  const result = await setFreeToProPromo(!!body.enabled)
  return NextResponse.json({ success: true, data: result })
}
