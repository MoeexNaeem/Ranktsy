/**
 * Canonical plan slugs + their Lemon Squeezy variant mapping.
 *
 * Server-only functions read process.env (the LS_VARIANT_* ids). The slug list
 * and CHECKOUT_PLANS are plain data and safe to import into client components.
 */
export type PlanSlug =
  | 'free' | 'starter' | 'basic' | 'pro' | 'pro-1yr'
  | 'business' | 'agency' | 'enterprise' | 'custom'

export const PLAN_SLUGS: PlanSlug[] = [
  'free', 'starter', 'basic', 'pro', 'pro-1yr', 'business', 'agency', 'enterprise', 'custom',
]

/** Human labels for UI (dashboard badge, admin, etc.). */
export const PLAN_LABELS: Record<PlanSlug, string> = {
  free: 'Free', starter: 'Starter', basic: 'Basic', pro: 'Pro', 'pro-1yr': 'Pro · 1-Year',
  business: 'Business', agency: 'Agency', enterprise: 'Enterprise', custom: 'Custom',
}

/**
 * The plan we should actually treat the user as being on. The Lemon Squeezy
 * webhook downgrades to 'free' on expiry, but this is a safety net for a missed
 * webhook: a non-active paid subscription whose paid period is over (renews_at +
 * 1-day grace) falls back to free. Active/trialing subs and admin-granted plans
 * (no subscription metadata) are kept as-is.
 */
export function effectivePlan(u: { plan?: PlanSlug | string; subscriptionStatus?: string | null; planRenewsAt?: Date | string | null }): PlanSlug {
  const plan = (u.plan ?? 'free') as PlanSlug
  if (plan === 'free') return 'free'
  const status = u.subscriptionStatus ?? ''
  if (status === 'expired') return 'free'
  if (status === 'active' || status === 'on_trial') return plan // trust active status even if renews_at is stale
  const renews = u.planRenewsAt ? new Date(u.planRenewsAt).getTime() : null
  if (renews != null && Date.now() > renews + 24 * 60 * 60 * 1000) return 'free'
  return plan
}

// Paid plans that map to a Lemon Squeezy variant (via env). Free & Custom don't.
const VARIANT_ENV: Record<string, string> = {
  starter:    'LS_VARIANT_STARTER',
  basic:      'LS_VARIANT_BASIC',
  pro:        'LS_VARIANT_PRO',
  'pro-1yr':  'LS_VARIANT_PRO_1YR',
  business:   'LS_VARIANT_BUSINESS',
  agency:     'LS_VARIANT_AGENCY',
  enterprise: 'LS_VARIANT_ENTERPRISE',
}

/** Slugs that trigger a Lemon Squeezy checkout (used by the client CTA logic). */
export const CHECKOUT_PLANS = Object.keys(VARIANT_ENV) as PlanSlug[]

/** Variant id for a plan slug (server-side; null for free/custom/unknown). */
export function variantIdFor(slug: string): string | null {
  const key = VARIANT_ENV[slug]
  return key ? (process.env[key] ?? null) : null
}

/** Reverse lookup: which plan a Lemon Squeezy variant id belongs to. */
export function planForVariant(variantId: string | number | undefined): PlanSlug | null {
  if (variantId == null) return null
  const vid = String(variantId)
  for (const [slug, key] of Object.entries(VARIANT_ENV)) {
    if (process.env[key] === vid) return slug as PlanSlug
  }
  return null
}
