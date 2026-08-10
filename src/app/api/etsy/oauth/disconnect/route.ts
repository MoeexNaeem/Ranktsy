import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { clearEtsyTokens } from '@/lib/etsy-tokens'

export const runtime = 'nodejs'

/** Disconnect ONE connected shop. Any other shops the user has connected are untouched. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const shopId = String(body?.shopId ?? '').trim()
  if (!shopId) return NextResponse.json({ success: false, error: 'Missing shopId' }, { status: 400 })

  await clearEtsyTokens(user.id, shopId)
  return NextResponse.json({ success: true })
}
