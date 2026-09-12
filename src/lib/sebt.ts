/**
 * SEBT NEXT education cohort.
 *
 * There are TWO separate 7-day clocks, on purpose:
 *  1. The BATCH WINDOW - the signup/login links (/register/sebtnext, /login/sebtnext)
 *     are open only during the batch. Batch 1 runs 7 days from `start` (Sep 12 →
 *     Sep 19, 2026). After it closes the pages show "SEBT Batch 1 has ended".
 *  2. Each STUDENT'S trial - a 7-day Enterprise grant counted from THEIR own signup
 *     (compExpiresAt on the user), after which they auto-revert to free. That lives
 *     in the register route + plan-lifecycle, not here.
 */
export const SEBT_BATCH = {
  name: 'Batch 1',
  // Asia/Karachi midnight so the window matches the team's local calendar day.
  start: '2026-09-12T00:00:00+05:00',
  days: 7,
} as const

export function sebtBatchEnd(): Date {
  return new Date(new Date(SEBT_BATCH.start).getTime() + SEBT_BATCH.days * 24 * 60 * 60 * 1000)
}

/** True while the SEBT signup/login links are still open. */
export function sebtBatchOpen(now: Date = new Date()): boolean {
  return now.getTime() < sebtBatchEnd().getTime()
}

/** Human date the batch closes, e.g. "September 19, 2026" (Asia/Karachi). */
export function sebtBatchEndLabel(): string {
  return sebtBatchEnd().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Karachi' })
}
