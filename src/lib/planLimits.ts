import type { PlanSlug } from './plans'

/**
 * Per-plan usage limits — the numbers shown on the pricing table, enforced.
 * `Infinity` means unlimited; `listingImagesPerMonth: 0` means the plan has no
 * access to Etsy Listing Pro image generation at all.
 */
export interface PlanLimits {
  searchesPerDay: number
  listingImagesPerMonth: number
  auditsPerDay: number
  competitors: number
}

const U = Infinity
export const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  free:        { searchesPerDay: 5,    listingImagesPerMonth: 1,  auditsPerDay: 5,    competitors: 0 },
  starter:     { searchesPerDay: 25,   listingImagesPerMonth: 2,  auditsPerDay: 20,   competitors: 2 },
  basic:       { searchesPerDay: 100,  listingImagesPerMonth: 3,  auditsPerDay: 50,   competitors: 5 },
  pro:         { searchesPerDay: 200,  listingImagesPerMonth: 5,  auditsPerDay: 200,  competitors: 50 },
  'pro-1yr':   { searchesPerDay: 200,  listingImagesPerMonth: 20, auditsPerDay: 200,  competitors: 50 },
  business:    { searchesPerDay: 500,  listingImagesPerMonth: 15, auditsPerDay: 500,  competitors: 100 },
  agency:      { searchesPerDay: 1000, listingImagesPerMonth: 30, auditsPerDay: 1000, competitors: 200 },
  enterprise:  { searchesPerDay: 2000, listingImagesPerMonth: 50, auditsPerDay: 2000, competitors: 500 },
  custom:      { searchesPerDay: U,    listingImagesPerMonth: 50, auditsPerDay: U,    competitors: U },
}

export function limitsFor(plan: PlanSlug | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? 'free'] ?? PLAN_LIMITS.free
}
