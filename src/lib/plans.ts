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
