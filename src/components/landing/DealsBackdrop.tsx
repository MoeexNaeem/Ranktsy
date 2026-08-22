/**
 * Decorative backdrop for the Deals pages - the same visual language as the
 * auth screens (dotted grid + soft blobs + dashed rings/curves + floating
 * shapes), but kept to a cohesive warm palette (orange / amber / gold) rather
 * than rainbow colours. Purely visual: aria-hidden, no pointer events.
 */
const ORANGE = '#FB5E09'
const AMBER = '#E8912B'
const GOLD = '#B7791F'

export function DealsBackdrop() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* dotted grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(61,62,59,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* soft warm colour blobs */}
      <div style={{ position: 'absolute', top: '-12%', left: '-8%', width: 540, height: 540, background: `radial-gradient(50% 50% at 50% 50%, ${ORANGE}26, transparent 70%)` }} />
      <div style={{ position: 'absolute', bottom: '-16%', right: '-6%', width: 560, height: 560, background: `radial-gradient(50% 50% at 50% 50%, ${GOLD}22, transparent 70%)` }} />
      <div style={{ position: 'absolute', top: '46%', right: '14%', width: 340, height: 340, background: `radial-gradient(50% 50% at 50% 50%, ${AMBER}1F, transparent 70%)` }} />

      {/* dashed rings */}
      <svg className="float-card" style={{ position: 'absolute', top: '7%', right: '9%', ['--dur' as string]: '7s' }} width="180" height="180" viewBox="0 0 180 180" fill="none">
        <circle cx="90" cy="90" r="78" stroke={ORANGE} strokeWidth="1.6" strokeDasharray="4 10" opacity="0.55" />
      </svg>
      <svg className="float-card" style={{ position: 'absolute', bottom: '10%', right: '24%', ['--dur' as string]: '9s', ['--delay' as string]: '0.8s' }} width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="52" stroke={GOLD} strokeWidth="1.6" strokeDasharray="2 9" opacity="0.5" />
      </svg>
      <svg style={{ position: 'absolute', top: '16%', left: '8%' }} width="96" height="96" viewBox="0 0 96 96" fill="none">
        <circle cx="48" cy="48" r="40" stroke={AMBER} strokeWidth="1.5" strokeDasharray="3 8" opacity="0.45" />
      </svg>

      {/* dashed curves */}
      <svg style={{ position: 'absolute', bottom: '8%', left: '4%' }} width="230" height="140" viewBox="0 0 230 140" fill="none">
        <path d="M10 118 C 70 20, 160 20, 220 118" stroke={GOLD} strokeWidth="1.6" strokeDasharray="3 9" opacity="0.5" />
      </svg>
      <svg style={{ position: 'absolute', top: '22%', right: '28%' }} width="180" height="90" viewBox="0 0 180 90" fill="none">
        <path d="M4 60 C 50 6, 130 84, 176 30" stroke={ORANGE} strokeWidth="1.5" strokeDasharray="2 8" opacity="0.45" />
      </svg>

      {/* geometric shapes */}
      <div className="float-card" style={{ position: 'absolute', top: '32%', left: '16%', width: 26, height: 26, borderRadius: 8, border: `2px solid ${GOLD}80`, transform: 'rotate(18deg)', ['--dur' as string]: '6s' }} />
      <div className="float-card" style={{ position: 'absolute', bottom: '30%', right: '13%', width: 20, height: 20, borderRadius: 6, background: `${ORANGE}80`, transform: 'rotate(-12deg)', ['--dur' as string]: '8s', ['--delay' as string]: '0.5s' }} />
      <div style={{ position: 'absolute', top: '70%', left: '12%', width: 14, height: 14, borderRadius: '50%', background: `${AMBER}8C` }} />
      <div style={{ position: 'absolute', top: '13%', left: '33%', width: 10, height: 10, borderRadius: '50%', background: `${GOLD}80` }} />
      <div style={{ position: 'absolute', bottom: '17%', left: '40%', width: 8, height: 8, borderRadius: '50%', background: `${ORANGE}8C` }} />

      {/* plus marks */}
      <span style={{ position: 'absolute', top: '40%', left: '9%', color: `${GOLD}73`, fontSize: 24, fontWeight: 300 }}>+</span>
      <span style={{ position: 'absolute', bottom: '35%', right: '29%', color: `${ORANGE}73`, fontSize: 22, fontWeight: 300 }}>+</span>
      <span style={{ position: 'absolute', top: '80%', right: '9%', color: `${AMBER}66`, fontSize: 20, fontWeight: 300 }}>+</span>
    </div>
  )
}
