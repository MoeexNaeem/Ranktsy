/**
 * Plans an admin can give SEBT NEXT students (no Free, no Custom). Client-safe:
 * the admin panel imports it, lib/sebt.ts (server) re-exports it.
 * Enterprise was the only option until 2026-10-08.
 */
export const SEBT_TRIAL_PLANS = ['starter', 'basic', 'pro', 'pro-1yr', 'business', 'agency', 'enterprise'] as const
export type SebtTrialPlan = typeof SEBT_TRIAL_PLANS[number]
export const isSebtTrialPlan = (p: unknown): p is SebtTrialPlan => SEBT_TRIAL_PLANS.includes(p as SebtTrialPlan)
