import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Deal } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { slugifyTitle, dealSummaryFrom, ensureDefaultDeals } from '@/lib/deals'
import type { ApiResponse, IDeal } from '@/types'

export const runtime = 'nodejs'

async function guard() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { auth }
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugifyTitle(base) || 'deal'
  let slug = root
  for (let n = 2; ; n++) {
    const clash = await Deal.findOne({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select('_id').lean()
    if (!clash) return slug
    slug = `${root}-${n}`
  }
}

// List all deals (drafts included) for the admin. Seeds the default 1-Year deal first.
export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  await connectDB()
  await ensureDefaultDeals()
  const deals = await Deal.find().sort({ createdAt: -1 })
    .select('title slug summary badge ctaLabel ctaPlan ctaUrl status createdAt updatedAt').lean<IDeal[]>()
  return NextResponse.json({ success: true, data: { deals } })
}

// Create a deal.
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const b = await req.json().catch(() => ({})) as Partial<IDeal>
  const title = String(b.title ?? '').trim()
  if (title.length < 3) return NextResponse.json({ success: false, error: 'Title is required.' }, { status: 400 })

  await connectDB()
  const content = String(b.content ?? '')
  const status = b.status === 'published' ? 'published' : 'draft'
  const doc = await Deal.create({
    title,
    slug: await uniqueSlug(b.slug || title),
    summary: (b.summary?.trim()) || dealSummaryFrom(content),
    content,
    badge: b.badge?.trim() || '',
    ctaLabel: b.ctaLabel?.trim() || 'Get this deal',
    ctaPlan: b.ctaPlan?.trim() || '',
    ctaUrl: b.ctaUrl?.trim() || '',
    status,
  })
  return NextResponse.json({ success: true, data: { id: doc._id.toString(), slug: doc.slug } })
}
