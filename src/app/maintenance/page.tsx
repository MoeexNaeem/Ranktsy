import type { Metadata } from 'next'
import Link from 'next/link'
import { getMaintenance } from '@/lib/maintenance'
import { C } from '@/utils'

/**
 * Shown to every non-admin visitor while maintenance mode is on. The proxy
 * rewrites all page requests here with HTTP 503 + Retry-After (src/proxy.ts), so
 * search engines treat the outage as temporary and keep the site indexed.
 * Visiting /maintenance directly while the site is UP just links back home.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'We are updating Rankkw',
  robots: { index: false, follow: false },
}

export default async function MaintenancePage() {
  const m = await getMaintenance().catch(() => null)
  const on = !!m?.on

  return (
    <main style={{ minHeight: '100vh', background: C.snow, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #e7e4da', borderRadius: 24, padding: 'clamp(28px, 6vw, 44px)', boxShadow: '0 24px 60px rgba(40,35,20,0.08)', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/website_logo.png" alt="Rankkw" style={{ width: 136, height: 44, objectFit: 'contain', display: 'block', margin: '0 auto 26px' }} />

        <div aria-hidden style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 20px', background: 'rgba(251,94,9,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <h1 style={{ fontSize: 'clamp(24px, 5vw, 30px)', fontWeight: 600, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 12px' }}>
          {on ? 'We are updating Rankkw' : 'Rankkw is up and running'}
        </h1>
        <p style={{ fontSize: 15, color: C.graphite, lineHeight: 1.65, margin: '0 auto 24px', maxWidth: 440 }}>
          {on ? m!.message : 'Everything is working normally.'}
        </p>

        {on ? (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: C.canvas, border: '1px solid #e7e4da', borderRadius: 999, padding: '8px 16px', fontSize: 13, color: C.graphite }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange, boxShadow: `0 0 0 4px rgba(251,94,9,0.15)` }} />
              Your account, credits and saved work are safe.
            </div>
            <p style={{ fontSize: 13, color: '#8a8a82', marginTop: 22, lineHeight: 1.6 }}>
              Please check back in a little while. Questions? Contact us at 0345 8181216.
            </p>
          </>
        ) : (
          <Link href="/" style={{ display: 'inline-block', background: C.charcoal, color: C.snow, padding: '11px 26px', borderRadius: 999, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Go to Rankkw</Link>
        )}
      </div>
    </main>
  )
}
