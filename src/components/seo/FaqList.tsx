'use client'
import { useState } from 'react'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

/** Reusable FAQ accordion (single-open) for SEO tool pages and blogs. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div style={{ borderTop: `1px solid ${C.ash}` }}>
      {items.map((f, i) => {
        const isOpen = open === i
        return (
          <div key={i} style={{ borderBottom: `1px solid ${C.ash}` }}>
            <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '20px 4px' }}>
              <span style={{ fontSize: 'clamp(16px,1.5vw,18px)', fontWeight: 500, color: C.ink, letterSpacing: '-0.01em' }}>{f.q}</span>
              <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', background: isOpen ? C.orange : C.bone, color: isOpen ? '#fff' : C.ink, display: 'grid', placeItems: 'center', transition: 'background 0.18s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 15.5, lineHeight: 1.6, color: C.graphite, padding: '0 40px 22px 4px', fontFamily: SANS, maxWidth: 760 }}>{f.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
