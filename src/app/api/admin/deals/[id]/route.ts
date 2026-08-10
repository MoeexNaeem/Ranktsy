import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Deal } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { slugifyTitle, dealSummaryFrom } from '@/lib/deals'
import type { ApiResponse, IDeal } from '@/types'

export const runtime = 'nodejs'

async function guard() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { auth }
}

async function uniqueSlug(base: string, exceptId: string): Promise<string> {
  const root = slugifyTitle(base) || 'deal'
  let slug = root
  for (let n = 2; ; n++) {
    const clash = await Deal.findOne({ slug, _id: { $ne: exceptId } }).select('_id').lean()
    if (!clash) return slug
    slug = `${root}-${n}`
  }
}

// Fetch one deal (for the editor).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const { id } = await params
  await connectDB()
  const deal = await Deal.findById(id).lean<IDeal>().catch(() => null)
  if (!deal) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: { deal } })
}

// Update a deal.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const { id } = await params
  const b = await req.json().catch(() => ({})) as Partial<IDeal>
  await connectDB()
  const existing = await Deal.findById(id).catch(() => null)
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  const content = b.content != null ? String(b.content) : existing.content
  if (b.title != null) existing.title = String(b.title).trim()
  if (b.slug != null && slugifyTitle(b.slug) !== existing.slug) existing.slug = await uniqueSlug(b.slug, id)
  existing.content = content
  existing.summary = (b.summary?.trim()) || dealSummaryFrom(content)
  if (b.badge != null) existing.badge = b.badge.trim()
  if (b.ctaLabel != null) existing.ctaLabel = b.ctaLabel.trim() || 'Get this deal'
  if (b.ctaPlan != null) existing.ctaPlan = b.ctaPlan.trim()
  if (b.ctaUrl != null) existing.ctaUrl = b.ctaUrl.trim()
  if (b.status === 'published' || b.status === 'draft') existing.status = b.status

  await existing.save()
  return NextResponse.json({ success: true, data: { id, slug: existing.slug } })
}

// Delete a deal.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const { id } = await params
  await connectDB()
  await Deal.findByIdAndDelete(id).catch(() => null)
  return NextResponse.json({ success: true, data: { id } })
}
