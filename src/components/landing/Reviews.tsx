'use client'
import { useRef } from 'react'
import { Reveal } from './Reveal'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

/* NOTE ON HONESTY: Rankkw's whole identity is "no fabricated data", and that has to
   hold for the testimonials too. Every `quote` below is a real Google review from a
   named reviewer, edited only for grammar and trimmed for length - nothing added,
   no invented job titles. The `stat` cards are all true facts about the product. */
type Card =
  | { kind: 'stat'; big: string; sub: string; body: string; bg: string; fg: string }
  | { kind: 'quote'; quote: string; who: string; role: string; bg: string; fg: string }

const CARDS: Card[] = [
  { kind: 'quote', bg: '#1E2A5A', fg: '#fff', who: 'Rumi Ch', role: 'Google review',
    quote: 'I’ve tested many Etsy research tools, but this one stands out because it focuses on finding profitable keywords instead of just showing data. It has helped me improve my titles, tags and listing strategy.' },
  { kind: 'stat', bg: '#3B5BFF', fg: '#fff', big: '100%', sub: 'real data',
    body: 'Every metric is measured live from the official Etsy & Google APIs. If it isn’t available, you see a dash - never an invented number.' },
  { kind: 'quote', bg: '#F3B6DD', fg: '#3D3E3B', who: 'Ali Raza', role: 'Google review',
    quote: 'RankKW has been a game-changer for my Etsy shop’s SEO. From keyword research to product research and listing optimization, it covers everything I need in one place. Super easy to use, even for beginners, and the insights are spot on.' },
  { kind: 'stat', bg: '#2E7D46', fg: '#fff', big: '33', sub: 'tools, one dashboard',
    body: 'Keywords, competitors, trends, listing audits and AI title / tag / description generators - all in one place.' },
  { kind: 'quote', bg: '#FB5E09', fg: '#fff', who: 'Khadija Javed', role: 'Google review',
    quote: 'RankKW has made finding low-competition keywords and writing Etsy titles and descriptions so much faster. It takes out the guesswork and saves a ton of manual effort when listing new items.' },
  { kind: 'stat', bg: '#14352A', fg: '#fff', big: '2', sub: 'live data sources',
    body: 'Live Etsy marketplace data and real Google search demand, cross-referenced on every single keyword you research.' },
  { kind: 'quote', bg: '#F3B6DD', fg: '#3D3E3B', who: 'Asma Aftab', role: 'Google review',
    quote: 'RankKW is a very useful tool for keyword research and SEO analysis. It’s simple to use and makes it easier to find and analyze keywords. I’m currently learning SEO, and it has helped my research and my understanding of keyword opportunities.' },
  { kind: 'quote', bg: '#1E2A5A', fg: '#fff', who: 'Muhammad Sayam', role: 'Google review',
    quote: 'One of the most useful features is the Etsy keyword research. Finding the right keywords matters, because a well-optimized listing reaches far more potential buyers. It also helps you analyze competitors and discover product opportunities.' },
  { kind: 'quote', bg: '#FB5E09', fg: '#fff', who: 'Hussnain Naeem', role: 'Google review',
    quote: 'I’ve been using RankKW for Etsy SEO, and I’ve found it very useful for keyword research, product research and competitor analysis. The platform is easy to use and brings several helpful features together in one place.' },
]

function Stars({ fg }: { fg: string }) {
  return (
    <div style={{ display: 'flex', gap: 3 }} aria-hidden>
      {[0, 1, 2, 3, 4].map(i => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={fg} style={{ opacity: 0.95 }}>
          <path d="M12 2l2.9 6.26L21.8 9.27l-4.9 4.6 1.2 6.86L12 17.5 5.9 20.73l1.2-6.86-4.9-4.6 6.9-1.01z" />
        </svg>
      ))}
    </div>
  )
}

function CardView({ c }: { c: Card }) {
  if (c.kind === 'stat') {
    return (
      <article className="rv-card" style={{ background: c.bg, color: c.fg }}>
        <div style={{ fontSize: 'clamp(56px,6.5vw,80px)', fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 0.95 }}>{c.big}</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 10, letterSpacing: '-0.01em' }}>{c.sub}</div>
        <p style={{ marginTop: 'auto', paddingTop: 24, fontSize: 15.5, lineHeight: 1.55, opacity: 0.92 }}>{c.body}</p>
      </article>
    )
  }
  return (
    <article className="rv-card" style={{ background: c.bg, color: c.fg }}>
      <Stars fg={c.fg} />
      <p style={{ fontSize: c.quote.length > 200 ? 17.5 : c.quote.length > 150 ? 19.5 : 'clamp(19px,1.9vw,23px)', fontWeight: 500, lineHeight: 1.45, letterSpacing: '-0.01em', marginTop: 18 }}>
        &ldquo;{c.quote}&rdquo;
      </p>
      <div style={{ marginTop: 'auto', paddingTop: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{c.who}</div>
        <div style={{ fontSize: 13.5, opacity: 0.82 }}>{c.role}</div>
      </div>
    </article>
  )
}

function NavBtn({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button aria-label={dir === 'prev' ? 'Previous' : 'Next'} onClick={onClick}
      style={{ width: 46, height: 46, borderRadius: '50%', border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'background 0.15s, border-color 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = C.bone; e.currentTarget.style.borderColor = C.ink }}
      onMouseLeave={e => { e.currentTarget.style.background = C.paper; e.currentTarget.style.borderColor = C.ash }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: dir === 'prev' ? 'rotate(180deg)' : 'none' }}>
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  )
}

export function Reviews() {
  const track = useRef<HTMLDivElement>(null)
  const scroll = (d: number) => track.current?.scrollBy({ left: d * 404, behavior: 'smooth' })

  return (
    <section id="reviews" style={{ background: C.canvas, padding: '104px 0 110px', backgroundImage: 'radial-gradient(rgba(61,62,59,0.07) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
        <Reveal>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 40, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.ink, marginBottom: 16 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />
                Reviews
              </div>
              <h2 style={{ fontSize: 'clamp(32px,4.4vw,54px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.04, maxWidth: 640 }}>
                Real data sellers actually trust
              </h2>
            </div>
            <div className="rhide-sm" style={{ display: 'flex', gap: 10 }}>
              <NavBtn dir="prev" onClick={() => scroll(-1)} />
              <NavBtn dir="next" onClick={() => scroll(1)} />
            </div>
          </div>
        </Reveal>
      </div>

      {/* Full-bleed track so cards can scroll off both edges */}
      <Reveal delay={0.06}>
        <div ref={track} className="rv-track" style={{ padding: '6px max(24px, calc((100vw - 1200px)/2 + 40px)) 22px' }}>
          {CARDS.map((c, i) => <CardView key={i} c={c} />)}
        </div>
      </Reveal>
    </section>
  )
}
