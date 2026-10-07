import type { PlanSlug } from './plans'

/**
 * Daily credit allowance per plan (resets 12:00 AM Pakistan time). One credit = one
 * search, so these are also the plan's searches per day (planLimits.ts must match).
 * Client-safe (no DB import): the admin SEBT panel shows these next to each plan.
 */
export const CREDITS_PER_DAY: Record<PlanSlug, number> = {
  free:        5,
  starter:     20,    // the $0.99 plan
  basic:       60,
  pro:         120,
  'pro-1yr':   150,   // the 1-Year plan
  business:    500,
  agency:      1000,
  enterprise:  2000,
  custom:      2000,
}
