'use client'
import { useState } from 'react'
import { Reveal } from './Reveal'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

/* Every answer is truthful and derivable from how the product actually works —
   no invented claims (in keeping with the "no fabricated data" identity). */
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is the data real, or estimated?',
    a: 'Real. Every number is measured live from the official Etsy Open API and Google Ads Keyword Planner. When a value isn’t available we show a dash — we never fill it with an invented figure.',
  },
  {
    q: 'Do I need to connect my Etsy shop?',
    a: 'No. Keyword research, competitor analysis and trend tools work without connecting anything. You only connect your shop (via secure Etsy OAuth) if you want your own views, favorites, orders and buyer analytics.',
  },
  {
    q: 'Where does the search-volume number come from?',
    a: 'From the Google Ads Keyword Planner — real monthly search demand, advertiser competition and CPC, with a per-country breakdown. Etsy itself doesn’t publish search volume, so we don’t pretend to.',
  },
  {
    q: 'How is Rankkw different from eRank or EtsyHunt?',
    a: 'We don’t show “estimated sales” or “estimated revenue”, because Etsy publishes no per-listing sales. Instead you get the true count of competing listings, real engagement (favorites ÷ views) and verified review counts — signals you can actually act on.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. The free plan includes daily keyword searches and the core metrics. Paid plans add more searches, the AI title/tag/description generators, competitor and shop analytics.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — you can upgrade, downgrade or cancel your plan whenever you like.',
  },
]

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.ash}` }}>
      <button className="faq-q" onClick={onToggle} aria-expanded={open}>
        <span style={{ fontSize: 'clamp(17px,1.6vw,19px)', fontWeight: 500, color: C.ink, letterSpacing: '-0.01em' }}>{q}</span>
        <span style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: open ? C.orange : C.bone, color: open ? '#fff' : C.ink, display: 'grid', placeItems: 'center', transition: 'background 0.18s' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: C.graphite, padding: '0 44px 24px 4px', maxWidth: 760 }}>{a}</p>
        </div>
      </div>
    </div>
  )
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" style={{ background: C.paper, padding: '110px 40px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.ink, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />
              FAQ
            </div>
            <h2 style={{ fontSize: 'clamp(32px,4.4vw,52px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.05 }}>
              Questions, answered
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <div style={{ borderTop: `1px solid ${C.ash}` }}>
            {FAQS.map((f, i) => (
              <Item key={i} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
