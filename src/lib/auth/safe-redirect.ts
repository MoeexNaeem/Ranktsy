/**
 * Post-login redirect targets come from the URL (?redirect=...), so anyone can craft a
 * link that tries to bounce a freshly signed-in user to another site. Only same-origin
 * relative paths are allowed; anything else falls back.
 *
 * Rejected: absolute URLs (https://evil.example), protocol-relative ones (//evil.example),
 * backslash tricks (/\evil.example, which browsers normalise to //evil.example), and
 * control characters (browsers strip tabs/newlines, so "/\t/evil.example" becomes
 * "//evil.example"). Query strings and hashes are kept, e.g. /dashboard?tab=notifications.
 *
 * Shared by the login/register form and the OAuth start + callback routes, so safe on
 * both client and server (no server-only imports).
 */
export const DEFAULT_AFTER_LOGIN = '/dashboard'

export function safeRedirectPath(raw: string | null | undefined, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return fallback
  if (raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return fallback
  if (/[\\\u0000-\u001F\u007F]/.test(raw)) return fallback

  // Belt and braces: resolve against a throwaway origin and make sure it stayed there.
  try {
    const base = 'http://same-origin.invalid'
    const u = new URL(raw, base)
    if (u.origin !== base) return fallback
    return u.pathname + u.search + u.hash
  } catch {
    return fallback
  }
}
