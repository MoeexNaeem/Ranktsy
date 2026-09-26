import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectDB } from '@/lib/db'
import { LocalPayment } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'

// Streams a local payment's proof screenshot / PDF. Admin only, never public.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  await connectDB()
  const pay = await LocalPayment.findById(id).select('+proof').lean<{ proof?: { name: string; contentType: string; data: string } | null } | null>()
  if (!pay?.proof?.data) return NextResponse.json({ success: false, error: 'No proof attached' }, { status: 404 })

  const buf = Buffer.from(pay.proof.data, 'base64')
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': pay.proof.contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(pay.proof.name)}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'private, max-age=3600',
      // Proofs are user uploads: never let one run as a page on our origin.
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
