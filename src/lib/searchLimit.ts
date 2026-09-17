/**
 * Per-user search rate gate for the dashboard tools.
 *
 * Rule: a SIGNED-IN user may run SEARCH_LIMIT_USER searches within a rolling hour
 * (default 150); anonymous/IP callers get SEARCH_LIMIT_ANON (default 25). Going over
 * asks for a reCAPTCHA, and solving it clears the counter. The point is to stop bots
 * and scrapers, not to interrupt real customers, so the signed-in limit is generous
 * and tunable without a deploy (SEARCH_LIMIT_USER / SEARCH_LIMIT_ANON env vars).
 *
 * Storage is an in-process Map - fine for a single Node host (this app's setup).
 * If it ever runs multi-instance, back this with Redis/Mongo; the limit would
 * then just be enforced per-instance until then (fails safe, never over-blocks a
 * legitimate user beyond their own instance).
 */
const envLimit = (name: string, fallback: number) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}
/** Signed-in users: generous, so normal research never hits a captcha. */
export const SEARCH_LIMIT_USER = envLimit('SEARCH_LIMIT_USER', 150)
/** Anonymous callers (by IP): tight, this is the bot surface. */
export const SEARCH_LIMIT_ANON = envLimit('SEARCH_LIMIT_ANON', 25)
/** Back-compat for callers that just want "the" limit. */
export const SEARCH_LIMIT = SEARCH_LIMIT_USER
const limitFor = (key: string) => (key.startsWith('u:') ? SEARCH_LIMIT_USER : SEARCH_LIMIT_ANON)
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
  return current(key).count < limitFor(key)
}

/** Count one search against the key's current window. */
export function recordSearch(key: string): void {
  current(key).count++
}

/** How many searches remain in the current window (for optional UI hints). */
export function searchesRemaining(key: string): number {
  return Math.max(0, limitFor(key) - current(key).count)
}

/** Reset the window - called after a valid captcha, granting the next 25. */
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
