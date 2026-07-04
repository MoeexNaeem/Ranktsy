import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'

async function requireAdmin() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), auth: null }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), auth: null }
  return { error: null, auth }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  if (body.role === 'user' || body.role === 'admin') update.role = body.role
  if (['free', 'grow', 'scale'].includes(body.plan)) update.plan = body.plan
  if (typeof body.isVerified === 'boolean') update.isVerified = body.isVerified
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
  }

  await connectDB()
  const u = await User.findByIdAndUpdate(id, update, { new: true }).lean()
  if (!u) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: { id, ...update } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, auth } = await requireAdmin()
  if (error) return error
  const { id } = await params

  if (auth && auth.id === id) {
    return NextResponse.json({ success: false, error: "You can't delete your own admin account here." }, { status: 400 })
  }

  await connectDB()
  const deleted = await User.findByIdAndDelete(id).lean()
  if (!deleted) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  await KeywordHistory.deleteMany({ userId: id }).catch(() => {})
  return NextResponse.json({ success: true, data: { id } })
}
