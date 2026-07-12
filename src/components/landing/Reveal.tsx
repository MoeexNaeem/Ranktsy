'use client'
import {
  Children, cloneElement, createContext, isValidElement, useContext,
  useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode,
} from 'react'

/**
 * Scroll-reveal helpers — IntersectionObserver + CSS transitions.
 * Robust by design: IO callbacks fire even in background tabs, and a safety
 * timer reveals content if the observer ever misfires — so a section can never
 * get stuck hidden. Motion (fade + slide-up + subtle scale, staggered) is tuned
 * to match the GSAP-animated hero.
 */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useInView<T extends HTMLElement>(once = true) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced()) { setInView(true); return }
    const reveal = () => setInView(true)
    // Already in (or near) the viewport on mount → reveal right away.
    const vh = window.innerHeight || 800
    const rect = el.getBoundingClientRect()
    if (rect.top < vh * 0.9 && rect.bottom > 0) { reveal(); return }
    if (typeof IntersectionObserver === 'undefined') { reveal(); return }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { reveal(); if (once) io.disconnect() } },
      { rootMargin: '0px 0px -90px 0px', threshold: 0.06 }
    )
    io.observe(el)
    // Safety net: never leave a section permanently hidden if IO misfires.
    const fallback = window.setTimeout(reveal, 2500)
    return () => { io.disconnect(); window.clearTimeout(fallback) }
  }, [once])
  return { ref, inView }
}

function revealStyle(shown: boolean, y: number, delay: number, dur = 0.72, scale = 0.985): CSSProperties {
  return {
    opacity: shown ? 1 : 0,
    transform: shown ? 'none' : `translateY(${y}px) scale(${scale})`,
    transition: `opacity ${dur}s ${EASE} ${delay}s, transform ${dur}s ${EASE} ${delay}s`,
    willChange: 'opacity, transform',
  }
}

/** Single block that fades + slides up once it enters the viewport. */
export function Reveal({ children, delay = 0, y = 32, style, className }: {
  children: ReactNode; delay?: number; y?: number; style?: CSSProperties; className?: string
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={className} style={{ ...style, ...revealStyle(inView, y, delay) }}>
      {children}
    </div>
  )
}

// ─── Staggered group + items ────────────────────────────────────────────────
const GroupCtx = createContext<{ inView: boolean; stagger: number; delayChildren: number }>({ inView: true, stagger: 0.1, delayChildren: 0 })

export function RevealGroup({ children, style, className, stagger = 0.1, delayChildren = 0 }: {
  children: ReactNode; style?: CSSProperties; className?: string; stagger?: number; delayChildren?: number
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  let i = 0
  return (
    <GroupCtx.Provider value={{ inView, stagger, delayChildren }}>
      <div ref={ref} className={className} style={style}>
        {Children.map(children, child =>
          isValidElement(child) ? cloneElement(child as ReactElement<{ _i?: number }>, { _i: i++ }) : child
        )}
      </div>
    </GroupCtx.Provider>
  )
}

/** A staggered child inside <RevealGroup>. */
export function RevealItem({ children, style, className, _i = 0 }: {
  children: ReactNode; style?: CSSProperties; className?: string; _i?: number
}) {
  const { inView, stagger, delayChildren } = useContext(GroupCtx)
  return (
    <div className={className} style={{ ...style, ...revealStyle(inView, 30, delayChildren + _i * stagger) }}>
      {children}
    </div>
  )
}

/** Entrance (reveals on mount) — for above-the-fold hero content. */
export function Entrance({ children, delay = 0, y = 20, style }: {
  children: ReactNode; delay?: number; y?: number; style?: CSSProperties
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => { setShown(true) }, [])
  return <div style={{ ...style, ...revealStyle(shown, y, delay, 0.75) }}>{children}</div>
}
