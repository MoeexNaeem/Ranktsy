'use client'
import { C } from '@/utils'
import { Reveal } from './Reveal'
import { SectionTag } from './Sections'

const SANS = "'General Sans',sans-serif"
const MONO = "'General Sans',monospace"

// Chrome Web Store listing. NEXT_PUBLIC_EXTENSION_URL can override the default.
const EXT_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || 'https://chromewebstore.google.com/detail/knedhblahbcfbdelhblenebocdpmhmcc'

const FEATURES: [string, string][] = [
  ['Keyword research', 'Search volume, competition and difficulty for any keyword, without leaving Etsy.'],
  ['Listing analytics', 'Estimated sales, revenue, views, favorites and conversion rate for any listing.'],
  ['Shop insights', 'Total sales, reviews, shop age and admirers for any Etsy shop you open.'],
  ['Tag extraction', 'See and copy all 13 tags behind any listing in a single click.'],
  ['Full audit in Rankkw', 'Jump straight from any Etsy page into your full Rankkw dashboard.'],
]

export function ExtensionSection() {
  return (
    <section id="extension" style={{ background: C.canvas, padding: '96px 24px 104px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'center', justifyContent: 'center' }}>

        {/* ── Left: headline + feature list ───────────────────────────────── */}
        <div style={{ flex: '1 1 360px', minWidth: 300, maxWidth: 460 }}>
          <Reveal>
            <SectionTag>Browser extension</SectionTag>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 style={{ fontSize: 'clamp(30px,3.6vw,46px)', fontWeight: 600, color: C.ink, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '14px 0 30px' }}>
              Etsy research, right where you sell
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {FEATURES.map(([label, desc]) => (
                <div key={label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ color: C.orange, fontWeight: 700, fontSize: 16, lineHeight: 1 }}>›</span>
                    <span style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{label}</span>
                  </div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.55, color: C.graphite, margin: '0 0 0 22px', maxWidth: 380 }}>{desc}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 34 }}>
              <a href={EXT_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.orange, color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: SANS, padding: '13px 24px', borderRadius: 100, textDecoration: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3.4" stroke="#fff" strokeWidth="1.8" />
                  <path d="M12 8.6h8.4M8.7 10.3 4.6 5.1M11 15.2 6.9 21" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Add to Chrome
              </a>
              <span style={{ fontSize: 13, color: C.graphite, fontFamily: MONO }}>Free · Chrome, Edge &amp; Brave</span>
            </div>
          </Reveal>
        </div>

        {/* ── Right: orange showcase panel with the real screenshot ───────── */}
        <div style={{ flex: '1 1 520px', minWidth: 300, maxWidth: 720, width: '100%' }}>
          <Reveal delay={0.18} y={28}>
            <div style={{
              position: 'relative',
              borderRadius: 26,
              padding: '52px 30px 34px',
              backgroundColor: C.orange,
              backgroundImage: 'linear-gradient(135deg,#FF7A2E 0%,#FB5E09 60%,#E64F00 100%), repeating-linear-gradient(115deg, rgba(255,255,255,0.10) 0 46px, rgba(255,255,255,0) 46px 92px)',
              backgroundBlendMode: 'normal, soft-light',
            }}>
              {/* floating view-tabs pill + cursor (mirrors the sample) */}
              <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', alignItems: 'center', gap: 4, background: '#fff', borderRadius: 100, padding: '7px 10px', boxShadow: '0 12px 30px rgba(20,18,14,0.20)', whiteSpace: 'nowrap' }}>
                {['Listing', 'Shop', 'Keywords'].map((t) => (
                  <span key={t} style={{ fontSize: 13.5, fontWeight: 600, fontFamily: SANS, padding: '6px 14px', borderRadius: 100, color: t === 'Keywords' ? '#fff' : C.ink, background: t === 'Keywords' ? C.orange : 'transparent' }}>{t}</span>
                ))}
                {/* cursor */}
                <svg width="26" height="26" viewBox="0 0 24 24" style={{ position: 'absolute', right: -12, bottom: -12 }} aria-hidden>
                  <path d="M5 3l14 7-6 1.6L9.8 18 5 3z" fill="#111" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>

              {/* browser frame holding the extension screenshot */}
              <figure className="cx-frame" style={{ margin: 0, position: 'relative', zIndex: 2 }}>
                <div className="cx-bar"><i /><i /><i /></div>
                <img
                  src="/extension-etsy-search.webp"
                  alt="Rankkw extension showing keyword volume, competition and per-listing sales on an Etsy search page"
                  loading="lazy"
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              </figure>

              {/* black tooltip callout (mirrors the sample) */}
              <div style={{ position: 'absolute', left: -14, bottom: 30, zIndex: 3 }}>
                <span style={{ display: 'inline-block', background: '#111', color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: SANS, padding: '11px 16px', borderRadius: 12, boxShadow: '0 12px 30px rgba(20,18,14,0.28)', whiteSpace: 'nowrap' }}>
                  Live on every Etsy page
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
