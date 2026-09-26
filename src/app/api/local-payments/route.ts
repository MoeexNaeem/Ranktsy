import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { LocalPayment, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { notifyAdmins } from '@/lib/notify'
import { rateLimit, tooManyResponse } from '@/lib/auth/rateLimit'
import { localPlanFor, validateProof, formatPkr, METHOD_LABELS, type LocalMethod } from '@/lib/local-payments'

export const runtime = 'nodejs'

const MAX_PENDING = 3

const serialize = (p: {
  _id: unknown; plan: string; method: string; amountPkr: number; reference?: string | null; hasProof: boolean
  status: string; adminNote?: string | null; grantedPlan?: string | null; grantedUntil?: Date | null; createdAt: Date
}) => ({
  id: String(p._id), plan: p.plan, method: p.method, amountPkr: p.amountPkr, reference: p.reference ?? null,
  hasProof: p.hasProof, status: p.status, adminNote: p.adminNote ?? null,
  grantedPlan: p.grantedPlan ?? null, grantedUntil: p.grantedUntil ?? null, createdAt: p.createdAt,
})

// The signed-in user's own local payment requests, newest first.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  await connectDB()
  const rows = await LocalPayment.find({ userId: user.id }).sort({ createdAt: -1 }).limit(20).lean()
  return NextResponse.json({ success: true, data: rows.map(serialize) })
}

// Submit a local payment: multipart form with plan, method, optional reference and
// the proof screenshot. Creates a 'pending' request for an admin to verify.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Please log in first.' }, { status: 401 })

  const rl = rateLimit(`localpay:${user.id}`, 6, 60 * 60 * 1000)
  if (!rl.allowed) return tooManyResponse(rl.retryAfterSec)

  const form = await req.formData().catch(() => null)
  const plan = localPlanFor(String(form?.get('plan') ?? ''))
  const method = String(form?.get('method') ?? '') as LocalMethod
  const reference = String(form?.get('reference') ?? '').trim().slice(0, 200) || null
  const file = form?.get('file')

  if (!plan) return NextResponse.json({ success: false, error: 'Choose a plan.' }, { status: 400 })
  if (method !== 'bank' && method !== 'jazzcash') return NextResponse.json({ success: false, error: 'Choose Bank transfer or JazzCash.' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'Attach a screenshot of your payment.' }, { status: 400 })
  const check = validateProof(file.type, file.size)
  if (!check.ok) return NextResponse.json({ success: false, error: check.error }, { status: 400 })

  await connectDB()
  const pending = await LocalPayment.countDocuments({ userId: user.id, status: 'pending' })
  if (pending >= MAX_PENDING) {
    return NextResponse.json({ success: false, error: 'You already have payments waiting for verification. We will review them shortly.' }, { status: 429 })
  }

  const dbUser = await User.findById(user.id).select('name email').lean<{ name?: string; email: string } | null>()
  const buffer = Buffer.from(await file.arrayBuffer())
  const doc = await LocalPayment.create({
    userId: user.id,
    userName: dbUser?.name ?? user.name ?? '',
    userEmail: dbUser?.email ?? user.email,
    plan: plan.slug,
    method,
    amountPkr: plan.pkr,
    reference,
    proof: { name: file.name.slice(0, 200), contentType: file.type, size: file.size, data: buffer.toString('base64') },
    hasProof: true,
    status: 'pending',
  })

  void notifyAdmins(
    `New local payment: ${plan.label} (${formatPkr(plan.pkr)})`,
    `${dbUser?.name || user.email} paid by ${METHOD_LABELS[method]}. Verify the screenshot in Admin, Local Payments.`,
    '/admin?section=localpayments',
    'info',
  )
  return NextResponse.json({ success: true, data: serialize(doc.toObject()) })
}
