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

/** Attach to an axios instance: any 402 `plan_limit` response opens the upgrade modal. */
export function attachUpgradeInterceptor(api: AxiosInstance): void {
  api.interceptors.response.use(
    r => r,
    (error) => {
      const resp = error?.response
      if (resp?.status === 402 && resp?.data?.code === 'plan_limit') {
        triggerUpgrade({
          title: 'You’ve hit your plan limit',
          message: resp.data.error || 'Upgrade your plan to continue.',
          plan: resp.data.plan,
        })
      }
      return Promise.reject(error)
    },
  )
}
