/**
 * Google reCAPTCHA v2 — server-side token verification.
 *
 * Keys (create at https://www.google.com/recaptcha/admin, type "v2 / I'm not a
 * robot Checkbox") go in the environment:
 *   • NEXT_PUBLIC_RECAPTCHA_SITE_KEY  — the public site key (used by the widget)
 *   • RECAPTCHA_SECRET_KEY            — the server secret (used here)
 *
 * Graceful by design: if the secret isn't set, verification is treated as a
 * PASS so the app keeps working in dev / before keys are added. Turning on
 * protection is therefore just "add the two env vars" — no code change.
 */
const SECRET = process.env.RECAPTCHA_SECRET_KEY ?? ''

/** True only when BOTH keys are present — the widget and the check are both live. */
export function isRecaptchaConfigured(): boolean {
  return !!SECRET && !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
}

/**
 * Verify a reCAPTCHA response token with Google. Returns true when the token is
 * valid — or when reCAPTCHA isn't configured (so the feature is a safe no-op
 * until keys are added).
 */
export async function verifyRecaptcha(token: string | null | undefined, remoteIp?: string): Promise<boolean> {
  if (!SECRET) return true          // not configured → don't block
  if (!token) return false          // configured but no token → fail

  try {
    const body = new URLSearchParams({ secret: SECRET, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (e) {
    console.error('[reCAPTCHA] verify failed:', e)
    return false                    // configured but Google unreachable → fail closed
  }
}
