import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Blog } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { slugifyTitle, readingMinutes, excerptFrom } from '@/lib/blog'
import type { ApiResponse, IBlog } from '@/types'

export const runtime = 'nodejs'

async function guard() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { auth }
}

async function uniqueSlug(base: string, exceptId: string): Promise<string> {
  const root = slugifyTitle(base) || 'post'
  let slug = root
  for (let n = 2; ; n++) {
    const clash = await Blog.findOne({ slug, _id: { $ne: exceptId } }).select('_id').lean()
    if (!clash) return slug
    slug = `${root}-${n}`
  }
}

// Fetch one post (for the editor).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const { id } = await params
  await connectDB()
  const post = await Blog.findById(id).lean<IBlog>().catch(() => null)
  if (!post) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: { post } })
}

// Update a post.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const { id } = await params
  const b = await req.json().catch(() => ({})) as Partial<IBlog>
  await connectDB()
  const existing = await Blog.findById(id).catch(() => null)
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  const content = b.content != null ? String(b.content) : existing.content
  const nextStatus = b.status === 'published' ? 'published' : b.status === 'draft' ? 'draft' : existing.status

  if (b.title != null) existing.title = String(b.title).trim()
  // Regenerate slug only if the admin explicitly changed it.
  if (b.slug != null && slugifyTitle(b.slug) !== existing.slug) existing.slug = await uniqueSlug(b.slug, id)
  existing.content = content
  existing.excerpt = (b.excerpt?.trim()) || excerptFrom(content)
  if (b.coverImage != null) existing.coverImage = b.coverImage.trim()
  if (b.category != null) existing.category = b.category.trim() || 'General'
  if (Array.isArray(b.tags)) existing.tags = b.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 12)
  if (b.author != null) existing.author = b.author.trim() || 'Rankkw'
  if (b.seoTitle != null) existing.seoTitle = b.seoTitle.trim()
  if (b.seoDescription != null) existing.seoDescription = b.seoDescription.trim()
  existing.readingMinutes = readingMinutes(content)
  // Stamp publishedAt the first time it goes live.
  if (nextStatus === 'published' && existing.status !== 'published') existing.publishedAt = new Date()
  existing.status = nextStatus

  await existing.save()
  return NextResponse.json({ success: true, data: { id, slug: existing.slug } })
}

// Delete a post.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const { id } = await params
  await connectDB()
  await Blog.findByIdAndDelete(id).catch(() => null)
  return NextResponse.json({ success: true, data: { id } })
}
