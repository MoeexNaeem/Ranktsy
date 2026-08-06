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

/** Ensure a unique slug (append -2, -3, … if taken). `exceptId` skips the row being edited. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugifyTitle(base) || 'post'
  let slug = root
  for (let n = 2; ; n++) {
    const clash = await Blog.findOne({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select('_id').lean()
    if (!clash) return slug
    slug = `${root}-${n}`
  }
}

// List all posts (drafts included) for the admin dashboard.
export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  await connectDB()
  const posts = await Blog.find().sort({ updatedAt: -1 })
    .select('title slug status category tags readingMinutes publishedAt updatedAt coverImage').lean<IBlog[]>()
  return NextResponse.json({ success: true, data: { posts } })
}

// Create a post.
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const g = await guard(); if (g.error) return g.error
  const b = await req.json().catch(() => ({})) as Partial<IBlog>
  const title = String(b.title ?? '').trim()
  if (title.length < 3) return NextResponse.json({ success: false, error: 'Title is required.' }, { status: 400 })

  await connectDB()
  const content = String(b.content ?? '')
  const status = b.status === 'published' ? 'published' : 'draft'
  const doc = await Blog.create({
    title,
    slug: await uniqueSlug(b.slug || title),
    content,
    excerpt: (b.excerpt?.trim()) || excerptFrom(content),
    coverImage: b.coverImage?.trim() || '',
    category: b.category?.trim() || 'General',
    tags: Array.isArray(b.tags) ? b.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 12) : [],
    status,
    author: b.author?.trim() || 'Rankkw',
    seoTitle: b.seoTitle?.trim() || '',
    seoDescription: b.seoDescription?.trim() || '',
    readingMinutes: readingMinutes(content),
    publishedAt: status === 'published' ? new Date() : null,
  })
  return NextResponse.json({ success: true, data: { id: doc._id.toString(), slug: doc.slug } })
}
