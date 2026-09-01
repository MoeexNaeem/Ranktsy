import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TrackedKeyword } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

// Stop watching a keyword. Only the owner can delete their own tracker.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  await connectDB()
  const res = await TrackedKeyword.deleteOne({ _id: id, userId: auth.id })
  if (!res.deletedCount) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: { id } })
}
