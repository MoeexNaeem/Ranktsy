/**
 * The "day" for daily credits and keyword searches: Pakistan time.
 *
 * Allowances reset at 12:00 AM Pakistan time (19:00 UTC). They used to reset at
 * 00:00 UTC, which is 5:00 AM in Pakistan, where most users are, so between their
 * midnight and 5 AM they saw nothing reset and reported that credits never reset
 * (owner's decision, 2026-10-06). Pakistan has no daylight saving, so a fixed
 * +5 h offset is exact all year.
 *
 * Shared by the server (credits.ts, quota.ts, admin views) and the browser
 * (the credits pill's reset timer), so every place agrees on when a day ends.
 */
const OFFSET_MS = 5 * 60 * 60 * 1000   // Asia/Karachi = UTC+5, no DST
const DAY_MS = 24 * 60 * 60 * 1000

/** The instant the current credit day began (Pakistan midnight). */
export function creditDayStart(d: Date = new Date()): Date {
  const local = d.getTime() + OFFSET_MS
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - OFFSET_MS)
}

/** When the next daily reset happens (the next Pakistan midnight). */
export function nextCreditReset(d: Date = new Date()): Date {
  return new Date(creditDayStart(d).getTime() + DAY_MS)
}

/** True when both instants fall in the same credit day. */
export function sameCreditDay(a?: Date | null, b?: Date | null): boolean {
  return !!a && !!b && creditDayStart(new Date(a)).getTime() === creditDayStart(new Date(b)).getTime()
}

/** 'YYYY-MM-DD' of the credit day (Pakistan date), for per-day records. */
export function creditDayKey(d: Date = new Date()): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}
