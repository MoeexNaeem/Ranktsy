import crypto from 'crypto'

/**
 * Breached-password check via the Have I Been Pwned "Pwned Passwords" range API,
 * using k-anonymity: only the first 5 chars of the SHA-1 hash are sent, never the
 * password. Returns how many breaches the password appeared in (0 = not found).
 *
 * Fails OPEN (returns 0) on any network/error — a signup must never be blocked by
 * HIBP being unreachable. It's an extra guard on top of the strong-password rules,
 * not the primary gate.
 */
export async function pwnedCount(password: string): Promise<number> {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      // Don't let a slow HIBP hang the request.
      signal: AbortSignal.timeout(3500),
    })
    if (!res.ok) return 0

    const text = await res.text()
    for (const line of text.split('\n')) {
      const [suf, count] = line.trim().split(':')
      if (suf === suffix) return parseInt(count ?? '0', 10) || 0
    }
    return 0
  } catch {
    return 0
  }
}
