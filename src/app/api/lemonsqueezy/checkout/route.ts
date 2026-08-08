import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createCheckoutUrl, isLemonConfigured } from '@/lib/lemonsqueezy'
import { variantIdFor } from '@/lib/plans'
import { siteUrl } from '@/lib/seo/site'

// Start a Lemon Squeezy checkout for the signed-in user + chosen plan.
// Returns { url } which the client opens in the Lemon.js overlay.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Please log in to subscribe.' }, { status: 401 })
  if (!isLemonConfigured()) return NextResponse.json({ success: false, error: 'Payments are not configured.' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { plan?: string }
  const plan = String(body.plan ?? '')
  const variantId = variantIdFor(plan)
  if (!variantId) return NextResponse.json({ success: false, error: 'That plan is not purchasable.' }, { status: 400 })

  const url = await createCheckoutUrl({
    variantId,
    userId: user.id,
    email: user.email,
    name: user.name,
    plan,
    redirectUrl: `${siteUrl()}/dashboard?checkout=success`,
  })
  if (!url) return NextResponse.json({ success: false, error: 'Could not start checkout. Please try again.' }, { status: 502 })

  return NextResponse.json({ success: true, url })
}
