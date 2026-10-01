'use client'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { C } from '@/utils'
import { AutomateComingSoon } from '@/components/automation/AutomateComingSoon'

/** Dashboard entry for Automate Listing: admins launch the builder, everyone else sees Coming soon. */
export function AutomateTab() {
  const { data: user } = useAuth()
  if (user?.role !== 'admin') return <AutomateComingSoon embedded />

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: 'clamp(20px, 4vw, 32px)', maxWidth: 760 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.orange, background: C.orangeFaint, padding: '4px 10px', borderRadius: 100 }}>Admin preview</span>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: C.charcoal, margin: '14px 0 8px' }}>Automate Listing</h2>
      <p style={{ fontSize: 14.5, color: C.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>
        Upload photos (and the files for digital items) per product. The workflow fills every Etsy listing section: category, title, 13 tags,
        description, attributes like Craft type, Occasion and Celebration, price, quantity and SKU, delivery and how it&apos;s made, then creates drafts in your shop.
        Other users see &ldquo;Coming soon&rdquo; until it is opened up.
      </p>
      <Link href="/automatelisting" style={{ display: 'inline-block', background: C.orange, color: '#fff', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Open the builder</Link>
    </div>
  )
}
