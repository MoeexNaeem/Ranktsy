import type { AxiosInstance } from 'axios'

/**
 * App-wide "upgrade" signal. A single modal host subscribes via onUpgrade; any
 * code (a 402 interceptor, a dashboard button) opens it with triggerUpgrade.
 */
export interface UpgradeInfo { title: string; message: string; plan?: string }
type Listener = (info: UpgradeInfo) => void
let listener: Listener | null = null

export function onUpgrade(l: Listener): () => void {
  listener = l
  return () => { if (listener === l) listener = null }
}
export function triggerUpgrade(info: UpgradeInfo): void { listener?.(info) }

/**
 * Attach to an axios instance: a 402 opens the upgrade modal.
 *
 * Two shapes reach here. 'plan_limit' is a per-plan cap (searches/day, audits).
 * 'credit_limit' is the daily credit allowance - a keyword search can hit either,
 * so both are handled or a user out of credits would see a bare error instead of
 * the upgrade prompt.
 */
export function attachUpgradeInterceptor(api: AxiosInstance): void {
  api.interceptors.response.use(
    r => r,
    (error) => {
      const resp = error?.response
      const code = resp?.data?.code
      if (resp?.status === 402 && (code === 'plan_limit' || code === 'credit_limit')) {
        // The response carries the exhausted balance; push it to the top-bar pill
        // so it reads 0 rather than the stale figure. Dispatched directly, not via
        // credits-client, because that module imports this one.
        if (resp.data.state && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rk-credits', { detail: resp.data.state }))
        }
        triggerUpgrade({
          title: code === 'credit_limit' ? 'You’re out of credits' : 'You’ve hit your plan limit',
          message: resp.data.error || 'Upgrade your plan to continue.',
          plan: resp.data.plan,
        })
      }
      return Promise.reject(error)
    },
  )
}
