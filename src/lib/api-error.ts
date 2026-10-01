/**
 * The user-facing message a failed API call carries, or `fallback`.
 *
 * Server routes already map provider failures to safe, specific sentences
 * ("Shop not found…", "temporarily unavailable…", "daily data limit…"); screens
 * that printed one fixed string for every error told users their real shop did
 * not exist whenever Etsy was busy. Use this so the real reason reaches them.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: unknown } }; message?: string } | null
  const server = e?.response?.data?.error
  if (typeof server === 'string' && server.trim()) return server
  // Errors thrown in a queryFn from a `success: false` body carry the server text.
  if (e?.message && !/^Request failed with status code|^Network Error|^timeout/i.test(e.message)) return e.message
  if (e?.message && /^Network Error|^timeout/i.test(e.message)) return 'Could not reach Rankkw. Check your connection and try again.'
  return fallback
}
