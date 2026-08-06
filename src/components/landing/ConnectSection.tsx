'use client'
import { C } from '@/utils'
import { Reveal } from './Reveal'
import { SectionTag } from './Sections'

const SANS = "'General Sans',sans-serif"

/* Illustrations live in /public/illustrations (copied from src/images). They are
   purely decorative, so every <img> is aria-hidden with an empty alt. */
const ILLO = {
  laptop:  '/illustrations/laptop.svg',
  windows: '/illustrations/windows.svg',
  ufo:     '/illustrations/ufo.svg',
  hair:    '/illustrations/hair.svg',
}

/* One illustration + a floating label chip. `bare` drops the browser-window
   chrome so a transparent illustration floats straight on the parchment. */
function Frame({
  src, label, width, style, dur, delay, rDelay = 0, bare = false, chipStyle,
}: {
  src: string; label: string; width: number
  style: React.CSSProperties; dur: number; delay: number; rDelay?: number
  bare?: boolean; chipStyle?: React.CSSProperties
}) {
  return (
    /* cx-item = absolute position · Reveal = scroll entrance · cx-float = idle
       drift. Three separate nodes so their transforms never collide. */
    <div className="cx-item" style={{ width, ...style }}>
      <Reveal delay={rDelay} y={26}>
        <div className="cx-float" style={{ position: 'relative', ['--dur' as string]: `${dur}s`, ['--delay' as string]: `${delay}s` }}>
          {bare ? (
            <figure className="cx-bare" style={{ margin: 0 }}><img src={src} alt="" aria-hidden /></figure>
          ) : (
            <figure className="cx-frame">
              <div className="cx-bar"><i /><i /><i /></div>
              <div className="cx-shot"><img src={src} alt="" aria-hidden /></div>
            </figure>
          )}
          <span className="cx-chip" style={chipStyle}>{label}</span>
        </div>
      </Reveal>
    </div>
  )
}

/* A round seller portrait + label chip. */
function Bubble({
  src, label, size, style, dur, delay, rDelay = 0,
}: {
  src: string; label: string; size: number
  style: React.CSSProperties; dur: number; delay: number; rDelay?: number
}) {
  return (
    <div className="cx-item" style={{ width: size, ...style }}>
      <Reveal delay={rDelay} y={26}>
        <div className="cx-float" style={{ position: 'relative', ['--dur' as string]: `${dur}s`, ['--delay' as string]: `${delay}s` }}>
          <div className="cx-bubble" style={{ width: size, height: size }}>
            <img src={src} alt="" aria-hidden />
          </div>
          <span className="cx-chip" style={{ left: '50%', transform: 'translateX(-50%)' }}>{label}</span>
        </div>
      </Reveal>
    </div>
  )
}

/* Four-point sparkle — echoes the doodles in the reference layout. */
function Spark({ size, color, style, dur, delay }: {
  size: number; color: string; style: React.CSSProperties; dur: number; delay: number
}) {
  return (
    <div
      className="cx-spark cx-float"
      style={{ ['--dur' as string]: `${dur}s`, ['--delay' as string]: `${delay}s`, ...style }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 0c.7 6.4 4.9 10.6 12 12-7.1 1.4-11.3 5.6-12 12-.7-6.4-4.9-10.6-12-12C7.1 10.6 11.3 6.4 12 0Z" fill={color} />
      </svg>
    </div>
  )
}

export function ConnectSection() {
  return (
    <section style={{ background: C.canvas, position: 'relative', overflow: 'hidden', padding: '96px 24px 104px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>

        {/* ── Desktop collage ─────────────────────────────────────────────── */}
        <div className="cx-collage cx-stage" aria-hidden={false}>

          {/* Hand-drawn ribbon threading the pieces together */}
          <svg className="cx-thread" viewBox="0 0 1240 660" preserveAspectRatio="none" fill="none">
            <path d="M170 250 C 360 150, 470 400, 640 360 S 930 470, 1080 300"
              stroke={C.ash} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 12" opacity="0.7" />
            <path d="M250 520 C 430 600, 640 470, 900 560"
              stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 11" opacity="0.5" />
          </svg>

          {/* Sparkles + dots */}
          <Spark size={26} color={C.orange} style={{ top: 30,  left: '45%' }} dur={5.5} delay={0.2} />
          <Spark size={16} color={C.ash}    style={{ top: 120, left: '31%' }} dur={6.2} delay={0.9} />
          <Spark size={20} color={C.ash}    style={{ bottom: 90, right: '34%' }} dur={5.8} delay={0.5} />
          <Spark size={13} color={C.orange} style={{ bottom: 46, left: '40%' }} dur={6.6} delay={1.2} />

          {/* Top-left — researching listings (framed browser card) */}
          <Frame src={ILLO.laptop} label="Keyword research" width={285}
            style={{ left: 0, top: 40 }} dur={6.4} delay={0} rDelay={0} />

          {/* Bottom-left — the seller (round portrait) */}
          <Bubble src={ILLO.hair} label="Built for sellers" size={150}
            style={{ left: 68, bottom: 22 }} dur={6.1} delay={0.9} rDelay={0.12} />

          {/* Top-right — gazing at the market (free-floating figure) */}
          <Frame src={ILLO.windows} label="Spot the opportunity" width={158} bare
            style={{ right: 10, top: 14 }} dur={5.8} delay={0.6} rDelay={0.24}
            chipStyle={{ left: 'auto', right: 0, bottom: -14 }} />

          {/* Bottom-right — real Etsy data (free-floating scene) */}
          <Frame src={ILLO.ufo} label="Real Etsy data" width={208} bare
            style={{ right: 8, bottom: 26 }} dur={6.9} delay={0.35} rDelay={0.36}
            chipStyle={{ left: 'auto', right: 20, bottom: -6 }} />

          {/* Centre lockup */}
          <div style={{
            position: 'relative', zIndex: 3, maxWidth: 540, margin: '0 auto',
            textAlign: 'center', padding: '20px 0',
          }}>
            <Reveal>
              <div style={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
                <SectionTag center>Real data, no guesswork</SectionTag>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 style={{
                fontSize: 'clamp(34px,4.4vw,56px)', fontWeight: 600, color: C.ink,
                letterSpacing: '-0.035em', lineHeight: 1.08, margin: '0 0 20px',
              }}>
                We connect sellers with<br />what&apos;s actually ranking
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p style={{
                fontSize: 'clamp(16px,1.4vw,18px)', lineHeight: 1.55, color: C.graphite,
                maxWidth: 460, margin: '0 auto',
              }}>
                Research keywords, size up the competition, and optimize your listings —
                every number measured live from the official Etsy API.
              </p>
            </Reveal>
          </div>
        </div>

        {/* ── Mobile / tablet stack ───────────────────────────────────────── */}
        <div className="cx-stack" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginBottom: 8 }}>
            <div style={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
              <SectionTag center>Real data, no guesswork</SectionTag>
            </div>
            <h2 style={{
              fontSize: 'clamp(28px,7vw,40px)', fontWeight: 600, color: C.ink,
              letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 16px',
            }}>
              We connect sellers with what&apos;s actually ranking
            </h2>
            <p style={{
              fontSize: 16, lineHeight: 1.55, color: C.graphite,
              maxWidth: 420, margin: '0 auto',
            }}>
              Research keywords, size up the competition, and optimize your listings —
              every number measured live from the official Etsy API.
            </p>
          </div>

          {[
            { src: ILLO.laptop,  label: 'Keyword research' },
            { src: ILLO.windows, label: 'Spot the opportunity' },
            { src: ILLO.ufo,     label: 'Real Etsy data' },
            { src: ILLO.hair,    label: 'Built for sellers' },
          ].map((it, i) => (
            <Reveal key={it.label} delay={i * 0.1} y={28}>
              <figure className="cx-frame" style={{ margin: 0 }}>
                <div className="cx-bar"><i /><i /><i /></div>
                <div className="cx-shot"><img src={it.src} alt="" aria-hidden /></div>
                <figcaption style={{
                  padding: '12px 16px 14px', fontFamily: SANS, fontSize: 13.5, fontWeight: 500,
                  color: C.ink, display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.cardBorder}`,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.orange, flex: 'none' }} />
                  {it.label}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
