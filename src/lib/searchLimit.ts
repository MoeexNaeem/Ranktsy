/**
 * Per-user search rate gate for the dashboard tools.
 *
 * Rule (from product): a user may run 25 searches within a rolling hour; the
 * 26th requires solving a reCAPTCHA to continue. Solving it clears the counter,
 * granting the next 25. This throttles bots/scrapers hammering the tools.
 *
 * Storage is an in-process Map — fine for a single Node host (this app's setup).
 * If it ever runs multi-instance, back this with Redis/Mongo; the limit would
 * then just be enforced per-instance until then (fails safe, never over-blocks a
 * legitimate user beyond their own instance).
 */
export const SEARCH_LIMIT = 25
const WINDOW_MS = 60 * 60 * 1000   // 1 hour

interface Entry { count: number; windowStart: number }
const store = new Map<string, Entry>()

function current(key: string): Entry {
  const now = Date.now()
  let e = store.get(key)
  if (!e || now - e.windowStart > WINDOW_MS) {
    e = { count: 0, windowStart: now }
    store.set(key, e)
  }
  return e
}

/** True if this key may run another search right now (under the hourly limit). */
export function isSearchAllowed(key: string): boolean {
  return current(key).count < SEARCH_LIMIT
}

/** Count one search against the key's current window. */
export function recordSearch(key: string): void {
  current(key).count++
}

/** How many searches remain in the current window (for optional UI hints). */
export function searchesRemaining(key: string): number {
  return Math.max(0, SEARCH_LIMIT - current(key).count)
}

/** Reset the window — called after a valid captcha, granting the next 25. */
export function clearSearchLimit(key: string): void {
  store.set(key, { count: 0, windowStart: Date.now() })
}

// Opportunistic cleanup so the Map can't grow unbounded over a long uptime.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, e] of store) if (now - e.windowStart > WINDOW_MS) store.delete(k)
  }, WINDOW_MS).unref?.()
}
