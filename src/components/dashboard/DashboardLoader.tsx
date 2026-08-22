'use client'
import { useEffect, useRef, useState } from 'react'
import { C } from '@/utils'

/**
 * Brand splash shown once when the dashboard mounts: the "Rankkw" wordmark drawn
 * on, stroke by stroke, with anime.js, over a faint "ghost" copy of the same
 * wordmark so a light line appears to trace itself along the letters.
 *
 * The wordmark is real font outlines (Segoe UI Bold) exported to <path> data.
 * The draw is done by animating each path's stroke-dashoffset from hidden to
 * shown (paths carry pathLength="1"), which is the most reliable form of SVG
 * line-drawing and needs no per-tick length recalculation. anime.js is bundled
 * (imported, not a CDN script) so it passes the site CSP. A hard fallback timer
 * guarantees the splash always clears, so it can never trap the user.
 */

// "Rankkw" — one outline <path> per letter, generated from the font, drawn left
// to right with a stagger. Group is translated to sit inside the 580×149 viewBox.
const LETTERS = [
  'M80.27 118.95L100.12 150L72.95 150L56.62 122.97Q54.79 119.90 53.10 117.48Q51.42 115.06 49.69 113.34Q47.97 111.62 46.11 110.71Q44.24 109.79 42.04 109.79L35.67 109.79L35.67 150L12.01 150L12.01 44.97L49.51 44.97Q87.74 44.97 87.74 73.54Q87.74 79.03 86.06 83.68Q84.38 88.33 81.30 92.07Q78.22 95.80 73.86 98.51Q69.51 101.22 64.16 102.76L64.16 103.05Q66.50 103.78 68.70 105.43Q70.90 107.08 72.95 109.28Q75 111.47 76.87 114Q78.74 116.53 80.27 118.95ZM46.36 62.70L35.67 62.70L35.67 91.92L45.92 91.92Q53.54 91.92 58.15 87.52Q62.84 83.06 62.84 76.46Q62.84 62.70 46.36 62.70Z',
  'M170.07 105.18L170.07 150L148.17 150L148.17 139.23L147.88 139.23Q140.33 151.83 125.54 151.83Q114.62 151.83 108.36 145.64Q102.10 139.45 102.10 129.13Q102.10 107.30 127.95 103.93L148.32 101.22Q148.32 88.92 134.99 88.92Q121.58 88.92 109.50 96.90L109.50 79.47Q114.33 76.98 122.72 75.07Q131.10 73.17 137.99 73.17Q170.07 73.17 170.07 105.18ZM148.32 119.53L148.32 114.48L134.69 116.24Q123.41 117.70 123.41 126.42Q123.41 130.37 126.16 132.90Q128.91 135.42 133.59 135.42Q140.11 135.42 144.21 130.92Q148.32 126.42 148.32 119.53Z',
  'M260.82 104.08L260.82 150L237.74 150L237.74 108.33Q237.74 90.89 225.29 90.89Q219.29 90.89 215.41 95.51Q211.52 100.12 211.52 107.23L211.52 150L188.38 150L188.38 75L211.52 75L211.52 86.87L211.82 86.87Q220.09 73.17 235.91 73.17Q260.82 73.17 260.82 104.08Z',
  'M325.49 110.23L354.27 150L326.51 150L302.56 112.79L302.27 112.79L302.27 150L279.13 150L279.13 38.96L302.27 38.96L302.27 109.64L302.56 109.64L324.90 75L352.37 75Z',
  'M409.35 110.23L438.13 150L410.38 150L386.43 112.79L386.13 112.79L386.13 150L362.99 150L362.99 38.96L386.13 38.96L386.13 109.64L386.43 109.64L408.76 75L436.23 75Z',
  'M534.01 75L555.47 75L533.86 150L509.55 150L498.49 106.05Q497.39 101.66 497.24 96.46L496.80 96.46Q496.29 102.17 495.34 105.76L483.47 150L459.45 150L438.28 75L461.87 75L472.19 123.93Q472.92 127.37 473.29 132.28L473.73 132.28Q474.10 127.15 475.05 123.63L487.94 75L509.99 75L521.56 123.93Q522 125.76 522.58 132.42L523.10 132.42Q523.46 128.17 524.27 123.93Z',
]

const INK = C.orange                       // brand orange for the drawn line
const GHOST = 'rgba(251,94,9,0.14)'        // faint copy underneath (the double line)

export function DashboardLoader({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const [filled, setFilled] = useState(false)   // true once the traced letters fill in
  const doneRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      try { sessionStorage.setItem('rk_splash_v1', '1') } catch { /* private mode */ }
      setLeaving(true)
      setTimeout(() => onDone(), 520)
    }

    // Play once per browser session — if it's already run, reveal the dashboard
    // instantly with no animation.
    try {
      if (sessionStorage.getItem('rk_splash_v1')) { onDone(); return }
    } catch { /* sessionStorage unavailable — just play it */ }

    // Hard safety net: never let the splash outstay ~2.8s regardless of anime.js.
    const failSafe = setTimeout(finish, 2800)

    import('animejs')
      .then((mod) => {
        if (cancelled) return
        // Handle both ESM namespace and interop-default shapes.
        const animate = mod.animate ?? (mod as { default?: typeof mod }).default?.animate
        const stagger = mod.stagger ?? (mod as { default?: typeof mod }).default?.stagger
        if (!animate || !stagger) return finish()
        animate('.rk-loader-line', {
          strokeDashoffset: [1, 0],
          ease: 'inOutQuad',
          duration: 760,
          delay: stagger(85),
          // Once the outline is fully traced, fill the letters solid, hold, then leave.
          onComplete: () => { setFilled(true); setTimeout(finish, 700) },
        })
      })
      .catch(() => finish())

    return () => { cancelled = true; clearTimeout(failSafe) }
  }, [onDone])

  return (
    <div
      aria-label="Loading Rankkw"
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, overflow: 'hidden',
        background: `radial-gradient(circle at 50% 44%, ${C.canvas} 0%, #ECE9DD 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 0.5s ease',
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* Background elements — a dotted grid that fades away behind the wordmark,
          plus two soft warm glows in opposite corners for depth. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(60,60,58,0.15) 1.6px, transparent 1.6px)', backgroundSize: '22px 22px', WebkitMaskImage: 'radial-gradient(circle at 50% 46%, transparent 18%, #000 58%)', maskImage: 'radial-gradient(circle at 50% 46%, transparent 18%, #000 58%)' }} />
      <div aria-hidden style={{ position: 'absolute', width: 460, height: 460, top: '-13%', left: '-6%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,94,9,0.11), transparent 64%)' }} />
      <div aria-hidden style={{ position: 'absolute', width: 520, height: 520, bottom: '-16%', right: '-8%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,94,9,0.09), transparent 64%)' }} />
      <svg viewBox="0 0 580 149" style={{ position: 'relative', zIndex: 1, width: 'min(190px, 46vw)', height: 'auto', overflow: 'visible' }} aria-hidden>
        <g transform="translate(5.99 -20.96)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Ghost underlayer — always visible, faint and thin */}
          {LETTERS.map((d, i) => (
            <path key={`g${i}`} d={d} stroke={GHOST} strokeWidth={2.1} />
          ))}
          {/* Bright line that traces itself over the ghost. Starts hidden
              (dashoffset 1); anime.js animates it to 0 to draw it on. */}
          {LETTERS.map((d, i) => (
            <path
              key={`d${i}`}
              className="rk-loader-line"
              d={d}
              fill={INK}
              stroke={INK}
              strokeWidth={3.6}
              pathLength={1}
              // While tracing: fill hidden, outline drawn by anime.js. Once `filled`,
              // the dash props drop (outline stays solid) and the fill fades in.
              style={filled
                ? { fillOpacity: 1, transition: 'fill-opacity 0.55s ease' }
                : { fillOpacity: 0, strokeDasharray: 1, strokeDashoffset: 1 }}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
