/**
 * Neutral, user-facing messages for failures that come from a data provider.
 *
 * Users must never see which service we call or its raw error text ("Etsy API
 * error 429: ...", "OpenAI", "Gemini"). It leaks implementation details, reads as
 * broken, and blames someone else for our product's behaviour. The real error is
 * logged server-side; the user gets a short, plain sentence and a next step.
 */

export interface UpstreamFailure { status: number; message: string }

const BUSY = 'This data is temporarily unavailable. Please try again in a moment.'
const GENERIC = 'Something went wrong loading this data. Please try again.'

/**
 * Map any provider error to a safe message + HTTP status.
 * `notFound` customises the wording for a genuine 404 (e.g. "Listing not found").
 */
export function upstreamFailure(err: unknown, notFound = 'That item could not be found. It may have been removed or is no longer active.'): UpstreamFailure {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  // Log the real cause for us; never return it.
  console.error('[upstream]', raw.slice(0, 300))

  if (/\b404\b|not found/i.test(raw)) return { status: 404, message: notFound }
  if (/\b(429|5\d\d)\b|rate limit|quota|timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(raw)) return { status: 503, message: BUSY }
  return { status: 502, message: GENERIC }
}
