'use client'
/**
 * Bridges the search rate gate to a reCAPTCHA prompt.
 *
 * When a gated search API returns 429 `{ captchaRequired: true }`, the axios
 * interceptor (attachCaptchaInterceptor) calls requestCaptcha(), which opens the
 * global <CaptchaModal>. Once the user solves it, the promise resolves with the
 * token and the original request is retried with an `x-captcha-token` header.
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

type RetriableConfig = InternalAxiosRequestConfig & { __captchaRetried?: boolean }

/** Attach the "429 → prompt captcha → retry" behaviour to an axios instance. */
export function attachCaptchaInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    r => r,
    async (error: { response?: { status?: number; data?: { captchaRequired?: boolean } }; config?: RetriableConfig }) => {
      const cfg = error.config
      const needsCaptcha = error.response?.status === 429 && error.response?.data?.captchaRequired
      if (needsCaptcha && cfg && !cfg.__captchaRetried) {
        try {
          const token = await requestCaptcha()
          cfg.__captchaRetried = true
          cfg.headers.set('x-captcha-token', token)
          return instance.request(cfg)
        } catch {
          // user cancelled — fall through to reject
        }
      }
      return Promise.reject(error)
    },
  )
}
