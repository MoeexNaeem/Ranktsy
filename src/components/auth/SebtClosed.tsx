import Link from 'next/link'
import { C } from '@/utils'
import { SEBT_BATCH, sebtBatchEndLabel } from '@/lib/sebt'

/**
 * Shown on /register/sebtnext and /login/sebtnext once the SEBT batch window has
 * closed. The signup/login links no longer grant the trial after this point.
 */
export function SebtClosed() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.canvas, padding: 24 }}>
      <div style={{ background: C.paper, borderRadius: 24, padding: '44px 40px', width: '100%', maxWidth: 460, border: `1px solid ${C.hairInk}`, boxShadow: '0 24px 60px rgba(61,62,59,0.12)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FDECEC', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 500, color: C.ink, letterSpacing: '-0.02em', marginBottom: 12 }}>
          SEBT NEXT {SEBT_BATCH.name} has ended
        </h1>
        <p style={{ fontSize: 15, color: '#6E6E64', lineHeight: 1.6, marginBottom: 28 }}>
          The free 7-day Enterprise access for SEBT NEXT {SEBT_BATCH.name} closed on {sebtBatchEndLabel()}. This signup link is no longer active. If a new batch opens, you will get a fresh link.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/register" style={{ display: 'block', background: C.orange, color: '#fff', borderRadius: 28, padding: '13px', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
            Create a free Rankkw account →
          </Link>
          <Link href="/" style={{ display: 'block', color: C.ink, fontSize: 13.5, textDecoration: 'none', fontWeight: 500 }}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
