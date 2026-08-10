import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { PopupAd } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { ensureDefaultPopupAd } from '@/lib/popupAd'
import type { ApiResponse, IPopupAd } from '@/types'

export const runtime = 'nodejs'

async function guard() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { auth }
}

const clean = (b: Partial<IPopupAd>) => ({
  mode: (b.mode === 'image' ? 'image' : 'card') as 'card' | 'image',
  badge: b.badge?.trim() || '',
  title: b.title?.trim() || '',
  description: b.description?.trim() || '',
  price: b.price?.trim() || '',
  priceNote: b.priceNote?.trim() || '',
  ctaLabel: b.ctaLabel?.trim() || 'Learn more',
  ctaUrl: b.ctaUrl?.trim() || '',
  imageUrl: b.imageUrl?.trim() || '',
  imageLink: b.imageLink?.trim() || '',
})

// List all popup ads (admin). Seeds the default first.
export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  await connectDB()
  await ensureDefaultPopupAd()
  const ads = await PopupAd.find().sort({ updatedAt: -1 }).lean<IPopupAd[]>()
  return NextResponse.json({ success: true, data: { ads } })
}

// Create an ad. Enabling one disables the others (only one shows at a time).
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const b = await req.json().catch(() => ({})) as Partial<IPopupAd>
  await connectDB()
  const enabled = !!b.enabled
  if (enabled) await PopupAd.updateMany({}, { $set: { enabled: false } })
  const doc = await PopupAd.create({ enabled, ...clean(b) })
  return NextResponse.json({ success: true, data: { id: doc._id.toString() } })
}
