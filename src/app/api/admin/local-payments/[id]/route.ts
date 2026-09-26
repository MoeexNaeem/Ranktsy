import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectDB } from '@/lib/db'
import { LocalPayment, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { notifyUser } from '@/lib/notify'
import { PLAN_LABELS, PLAN_SLUGS, type PlanSlug } from '@/lib/plans'
import { addMonths, localPlanFor } from '@/lib/local-payments'

export const runtime = 'nodejs'

/**
 * Review a local payment. Body:
 *   { action: 'approve', plan?: PlanSlug, months?: number, note?: string }
 *     → grants `plan` (default: the plan paid for) until now + months (default: the
 *       plan's period, 1 month or 12 for Pro 1-Year). Uses compExpiresAt, so the user
 *       drops back to free exactly then and sees the "plan expired" popup.
 *   { action: 'reject', note?: string }   → rejected, user notified (plan untouched)
 *   { action: 'pending' }                 → back to pending (plan untouched)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as { action?: string; plan?: string; months?: number; note?: string }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null

  await connectDB()
  const pay = await LocalPayment.findById(id)
  if (!pay) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  if (body.action === 'approve') {
    const plan = (body.plan && (PLAN_SLUGS as string[]).includes(body.plan) ? body.plan : pay.plan) as PlanSlug
    if (plan === 'free') return NextResponse.json({ success: false, error: 'Choose a paid plan to grant.' }, { status: 400 })
    const defaultMonths = localPlanFor(pay.plan)?.months ?? 1
    const months = Number.isFinite(body.months) && Number(body.months) >= 1 && Number(body.months) <= 24 ? Math.round(Number(body.months)) : defaultMonths
    const until = addMonths(months)

    const user = await User.findById(pay.userId)
    if (!user) return NextResponse.json({ success: false, error: 'That user no longer exists.' }, { status: 404 })
    user.plan = plan
    user.compExpiresAt = until
    // A fresh grant clears any old "plan expired" popup.
    user.lastExpiredPlan = null
    user.planExpiredAt = null
    user.planExpiryNoticeSeen = true
    await user.save()

    pay.status = 'approved'
    pay.grantedPlan = plan
    pay.grantedUntil = until
    pay.adminNote = note
    pay.reviewedAt = new Date()
    pay.reviewedBy = auth.email
    await pay.save()

    const untilText = until.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    void notifyUser(pay.userId, `Payment verified: ${PLAN_LABELS[plan]} plan is active`,
      `Thank you! Your ${PLAN_LABELS[plan]} plan is active until ${untilText}.`, '/dashboard', 'success')
    return NextResponse.json({ success: true, data: { status: 'approved', grantedPlan: plan, grantedUntil: until } })
  }

  if (body.action === 'reject') {
    pay.status = 'rejected'
    pay.adminNote = note
    pay.reviewedAt = new Date()
    pay.reviewedBy = auth.email
    await pay.save()
    void notifyUser(pay.userId, 'We could not verify your payment',
      note ? `Reason: ${note} If you think this is a mistake, contact us on WhatsApp or support chat.`
        : 'Please check the details and submit again, or contact us on WhatsApp or support chat.',
      '/local-payment', 'info')
    return NextResponse.json({ success: true, data: { status: 'rejected' } })
  }

  if (body.action === 'pending') {
    pay.status = 'pending'
    pay.reviewedAt = null
    pay.reviewedBy = null
    await pay.save()
    return NextResponse.json({ success: true, data: { status: 'pending' } })
  }

  return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 })
}
