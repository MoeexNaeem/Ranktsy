'use client'
import { useEffect } from 'react'

/**
 * Affiliate referral capture. When a visitor lands on any page with ?ref=CODE we
 * ping /api/affiliate/click once, which drops the first-party rk_ref cookie so
 * attribution survives to signup and counts the visit. Fires at most once per
 * code per browser session (sessionStorage) to avoid re-counting on navigation.
 * Renders nothing.
 */
export function RefCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('ref')
      if (!code) return
      const clean = code.trim().toLowerCase()
      if (!/^[a-z0-9]{1,40}$/.test(clean)) return
      const key = `rk_ref_sent:${clean}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
      fetch('/api/affiliate/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean }),
        keepalive: true,
      }).catch(() => {})
    } catch { /* sessionStorage or URL parsing can throw in rare contexts */ }
  }, [])
  return null
}
