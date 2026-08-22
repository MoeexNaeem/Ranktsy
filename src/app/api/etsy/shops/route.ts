import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { listConnectedShops } from '@/lib/etsy-tokens'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Every Etsy shop the signed-in user has connected - always read fresh from the DB. */
export async function GET(): Promise<NextResponse<ApiResponse<{ shopId: string; shopName: string; connectedAt: Date }[]>>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const shops = await listConnectedShops(user.id)
  return NextResponse.json({ success: true, data: shops })
}
