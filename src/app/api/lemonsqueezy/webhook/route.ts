import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { verifyWebhookSignature } from '@/lib/lemonsqueezy'
import { planForVariant, PLAN_SLUGS, type PlanSlug } from '@/lib/plans'

// Lemon Squeezy webhook — the source of truth for a user's plan. Verifies the
// signature, then applies subscription changes to the matching user.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(req: NextRequest) {
  const raw = await req.text() // raw body required for signature verification
  if (!verifyWebhookSignature(raw, req.headers.get('x-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: any
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const event = String(payload?.meta?.event_name ?? '')
  const custom = payload?.meta?.custom_data ?? {}
  const attrs = payload?.data?.attributes ?? {}
  const subId = payload?.data?.id ? String(payload.data.id) : undefined

  // Only subscription events matter here.
  if (!event.startsWith('subscription')) return NextResponse.json({ received: true })

  const userId = custom.user_id ? String(custom.user_id) : undefined
  const variantId = attrs.variant_id
  const planFromCustom = typeof custom.plan === 'string' && (PLAN_SLUGS as string[]).includes(custom.plan)
    ? custom.plan as PlanSlug : null
  const plan = planFromCustom ?? planForVariant(variantId)

  try {
    await connectDB()

    // Prefer our own user_id; fall back to the buyer's email.
    let user = userId ? await User.findById(userId).catch(() => null) : null
    if (!user && attrs.user_email) user = await User.findOne({ email: String(attrs.user_email).toLowerCase() })
    if (!user) return NextResponse.json({ received: true }) // ack — nothing we can attach to

    const status = String(attrs.status ?? '')

    if (['subscription_created', 'subscription_updated', 'subscription_resumed', 'subscription_payment_success', 'subscription_unpaused'].includes(event)) {
      if (plan) user.plan = plan
      user.subscriptionStatus = status || 'active'
      if (subId) user.lsSubscriptionId = subId
      if (attrs.customer_id) user.lsCustomerId = String(attrs.customer_id)
      if (variantId) user.lsVariantId = String(variantId)
      if (attrs.renews_at) user.planRenewsAt = new Date(attrs.renews_at)
    } else if (event === 'subscription_expired') {
      user.plan = 'free'
      user.subscriptionStatus = 'expired'
    } else if (event === 'subscription_cancelled') {
      // Still has access until renews_at; LS sends `expired` when it actually ends.
      user.subscriptionStatus = 'cancelled'
    } else if (event === 'subscription_paused') {
      user.subscriptionStatus = 'paused'
    } else if (event === 'subscription_payment_failed') {
      user.subscriptionStatus = 'past_due'
    }

    await user.save()
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[LS webhook]', err)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
