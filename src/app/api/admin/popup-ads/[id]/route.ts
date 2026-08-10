import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { PopupAd } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import type { ApiResponse, IPopupAd } from '@/types'

export const runtime = 'nodejs'

async function guard() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { auth }
}

// Update an ad. Enabling one disables the others (only one shows at a time).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const { id } = await params
  const b = await req.json().catch(() => ({})) as Partial<IPopupAd>
  await connectDB()
  const existing = await PopupAd.findById(id).catch(() => null)
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  if (typeof b.enabled === 'boolean') {
    existing.enabled = b.enabled
    if (b.enabled) await PopupAd.updateMany({ _id: { $ne: id } }, { $set: { enabled: false } })
  }
  if (b.mode === 'card' || b.mode === 'image') existing.mode = b.mode
  if (b.badge != null) existing.badge = b.badge.trim()
  if (b.title != null) existing.title = b.title.trim()
  if (b.description != null) existing.description = b.description.trim()
  if (b.price != null) existing.price = b.price.trim()
  if (b.priceNote != null) existing.priceNote = b.priceNote.trim()
  if (b.ctaLabel != null) existing.ctaLabel = b.ctaLabel.trim() || 'Learn more'
  if (b.ctaUrl != null) existing.ctaUrl = b.ctaUrl.trim()
  if (b.imageUrl != null) existing.imageUrl = b.imageUrl.trim()
  if (b.imageLink != null) existing.imageLink = b.imageLink.trim()

  await existing.save()
  return NextResponse.json({ success: true, data: { id } })
}

// Delete an ad.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const { id } = await params
  await connectDB()
  await PopupAd.findByIdAndDelete(id).catch(() => null)
  return NextResponse.json({ success: true, data: { id } })
}
