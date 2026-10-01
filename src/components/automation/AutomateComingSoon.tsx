import Link from 'next/link'
import { C } from '@/utils'

/**
 * What everyone except admins sees for Automate Listing (on /automatelisting and
 * in the dashboard tab). `embedded` drops the full-page chrome for the dashboard.
 */
const STEPS = [
  ['Upload your photos', 'Up to 20 per product, plus the PDF or files for digital items.'],
  ['Rankkw fills the listing', 'Category, title, 13 tags, description, attributes, price, SKU and delivery, from real Etsy and Google data.'],
  ['Review your drafts', 'Every product lands in your Etsy shop as a draft, ready to check and publish.'],
] as const

export function AutomateComingSoon({ embedded = false }: { embedded?: boolean }) {
  const card = (
    <div style={{ maxWidth: 620, width: '100%', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 20, padding: 'clamp(22px, 5vw, 40px)', textAlign: 'center' }}>
      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.orange, background: C.orangeFaint, padding: '5px 12px', borderRadius: 100 }}>Coming soon</span>
      <h1 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 600, color: C.charcoal, margin: '16px 0 10px', letterSpacing: '-0.02em' }}>Automate Listing</h1>
      <p style={{ fontSize: 15, color: C.inkSoft, lineHeight: 1.6, margin: '0 auto 26px', maxWidth: 460 }}>
        Add your product photos and Rankkw builds the whole Etsy listing for you. We are finishing it now and will open it to everyone soon.
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 26px', display: 'grid', gap: 10, textAlign: 'left' }}>
        {STEPS.map(([t, d], i) => (
          <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: C.bg, borderRadius: 12, padding: '12px 14px' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: C.orange, color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 14, color: C.charcoal, fontWeight: 600 }}>{t}</strong>
              <span style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{d}</span>
            </span>
          </li>
        ))}
      </ol>
      {!embedded && (
        <Link href="/dashboard" style={{ display: 'inline-block', background: C.charcoal, color: '#fff', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Back to dashboard</Link>
      )}
    </div>
  )
  if (embedded) return <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>{card}</div>
  return <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>{card}</main>
}
