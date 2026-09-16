'use client'

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'
import axios from 'axios'
import { attachCaptchaInterceptor } from '@/components/security/captchaController'
import { CaptchaModal } from '@/components/security/CaptchaModal'
import { PopupAdHost } from '@/components/landing/PopupAdHost'
import { toast } from '@/components/ui/toast'

// ── Global error toasts ─────────────────────────────────────────────────────────
// Every failed query (first load only, not a background refetch that still has data)
// and every failed mutation pops an error toast, so failures are visible everywhere
// without each tab wiring its own. Opt out per query/mutation with `meta: { silent: true }`.
// Auth failures (401/403) are skipped: those are handled by redirects/login prompts.
function errorInfo(err: unknown): { status?: number; message: string } {
  const e = err as { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string }
  const status = e?.response?.status
  const serverMsg = e?.response?.data?.error || e?.response?.data?.message
  let message = serverMsg || e?.message || 'Something went wrong. Please try again.'
  if (!serverMsg && /Network Error|Failed to fetch/i.test(message)) message = 'Network error. Check your connection and try again.'
  if (!serverMsg && /status code \d+/i.test(message)) message = status && status >= 500 ? 'The server had a problem. Please try again in a moment.' : 'The request failed. Please try again.'
  return { status, message }
}
function shouldToast(err: unknown, meta?: Record<string, unknown>) {
  if (meta?.silent) return false
  const { status } = errorInfo(err)
  if (status === 401 || status === 403) return false
  if ((err as Error)?.message === 'Captcha unavailable') return false
  return true
}
// Several parallel queries often fail with the same message; show it once.
const recentErrors = new Map<string, number>()
function toastOnce(title: string, message: string) {
  const key = `${title}|${message}`
  const now = Date.now()
  if ((recentErrors.get(key) ?? 0) > now - 4000) return
  recentErrors.set(key, now)
  toast.error(title, message)
}

// Attach the "search-limit → captcha → retry" interceptor to the default axios
// instance once (covers all `axios.get('/api/...')` calls in the dashboard tabs).
// The useKeywords `api` instance attaches it separately.
let interceptorAttached = false
if (typeof window !== 'undefined' && !interceptorAttached) {
  interceptorAttached = true
  attachCaptchaInterceptor(axios)
}

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session; useState ensures it's not recreated on re-render
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (err, query) => {
            if (query.state.data !== undefined) return
            if (!shouldToast(err, query.meta)) return
            toastOnce((query.meta?.errorTitle as string) || 'Couldn’t load data', errorInfo(err).message)
          },
        }),
        mutationCache: new MutationCache({
          onError: (err, _vars, _ctx, mutation) => {
            if (!shouldToast(err, mutation.meta)) return
            toastOnce((mutation.meta?.errorTitle as string) || 'Action failed', errorInfo(err).message)
          },
        }),
        defaultOptions: {
          queries: {
            staleTime:            1000 * 60 * 5,  // 5 min - data considered fresh
            gcTime:               1000 * 60 * 30, // 30 min - garbage collect unused cache
            refetchOnWindowFocus: false,           // don't refetch every tab switch
            retry:                2,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <CaptchaModal />
      <PopupAdHost />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
