'use client'
/**
 * Bridges the search gate to a reCAPTCHA prompt.
 *
 * When a gated search API returns 429 `{ captchaRequired: true }` (every 10 new
 * searches), the axios interceptor asks for ONE human check: the global
 * <CaptchaModal> opens, the solved token is verified once by /api/captcha/verify
 * (which resets the account's count on the server), and then every request that
 * was waiting retries. A search fires several requests at once, so they all
 * share the same pending check instead of each opening its own.
 */
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

type Opener = (resolve: (token: string) => void, reject: (reason?: unknown) => void) => void
let opener: Opener | null = null

/** The <CaptchaModal> registers itself here on mount. */
export function registerCaptchaModal(fn: Opener | null) { opener = fn }

/** Open the captcha modal and resolve with the solved token (rejects if cancelled). */
export function requestCaptcha(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!opener) { reject(new Error('Captcha unavailable')); return }
    opener(resolve, reject)
  })
}

/** Send a solved token to the server. Throws with a readable message on failure. */
export async function submitCaptcha(token: string): Promise<void> {
  const res = await fetch('/api/captcha/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  })
  const j = await res.json().catch(() => null) as { success?: boolean; error?: string } | null
  if (!res.ok || !j?.success) throw new Error(j?.error || 'Verification failed. Please try again.')
}

// One human check at a time, shared by every request that needs it.
let pending: Promise<void> | null = null
function ensureHuman(): Promise<void> {
  pending ??= requestCaptcha()          // the modal verifies the token itself
    .then(() => undefined)
    .finally(() => { pending = null })
  return pending
}

type RetriableConfig = InternalAxiosRequestConfig & { __captchaRounds?: number }

const attached = new WeakSet<AxiosInstance>()

/** Attach the "429 → human check → retry" behaviour to an axios instance. */
export function attachCaptchaInterceptor(instance: AxiosInstance) {
  if (attached.has(instance)) return
  attached.add(instance)
  instance.interceptors.response.use(
    r => r,
    async (error: { response?: { status?: number; data?: { captchaRequired?: boolean } }; config?: RetriableConfig }) => {
      const cfg = error.config
      const needsCaptcha = error.response?.status === 429 && error.response?.data?.captchaRequired
      // Two rounds at most: a second prompt covers the rare case where another tab
      // used up the fresh allowance in between.
      if (needsCaptcha && cfg && (cfg.__captchaRounds ?? 0) < 2) {
        try {
          await ensureHuman()
          cfg.__captchaRounds = (cfg.__captchaRounds ?? 0) + 1
          return instance.request(cfg)
        } catch {
          // user cancelled - fall through to reject
        }
      }
      return Promise.reject(error)
    },
  )
}
