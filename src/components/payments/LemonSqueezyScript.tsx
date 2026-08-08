'use client'
import Script from 'next/script'

// Loads Lemon.js so checkout URLs open in a polished overlay instead of a full
// page redirect. `createLemonSqueezy()` must run once after the script loads.
export function LemonSqueezyScript() {
  return (
    <Script
      src="https://app.lemonsqueezy.com/js/lemon.js"
      strategy="afterInteractive"
      onLoad={() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(window as any).createLemonSqueezy?.()
        } catch { /* overlay just won't be available; we fall back to redirect */ }
      }}
    />
  )
}
