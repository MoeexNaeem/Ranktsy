'use client'
import {
  Children, cloneElement, createContext, isValidElement, useContext,
  useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode,
} from 'react'

/**
 * Subtle scroll-reveal helpers — native IntersectionObserver + CSS transitions.
 * (Framer Motion did not animate under this Next 16 / React 19 setup, so this
 * dependency-free implementation is used instead. Same gentle fade + slide-up,
 * tuned to keep the flat Huddle editorial calm.)
 */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

function useInView<T extends HTMLElement>(once = true) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reveal = () => setInView(true)
    // If it's already within (or near) the viewport on mount, reveal right away.
    // This runs from useEffect (not rAF), so above-the-fold content shows even
    // where rAF/IntersectionObserver are throttled.
    const vh = window.innerHeight || 800
    const rect = el.getBoundingClientRect()
    if (rect.top < vh * 0.92 && rect.bottom > 0) { reveal(); return }
    if (typeof IntersectionObserver === 'undefined') { reveal(); return }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { reveal(); if (once) io.disconnect() } },
      { rootMargin: '0px 0px -80px 0px', threshold: 0.05 }
    )
    io.observe(el)
    // Safety net: never let a section stay permanently hidden if IO misfires.
    const fallback = window.setTimeout(reveal, 2500)
    return () => { io.disconnect(); window.clearTimeout(fallback) }
  }, [once])
  return { ref, inView }
}

function revealStyle(shown: boolean, y: number, delay: number, dur = 0.55): CSSProperties {
  return {
    opacity: shown ? 1 : 0,
    transform: shown ? 'none' : `translateY(${y}px)`,
    transition: `opacity ${dur}s ${EASE} ${delay}s, transform ${dur}s ${EASE} ${delay}s`,
    willChange: 'opacity, transform',
  }
}

/** Single block that fades + slides up once it enters the viewport. */
export function Reveal({ children, delay = 0, y = 18, style, className }: {
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
const GroupCtx = createContext<{ inView: boolean; stagger: number; delayChildren: number }>({ inView: true, stagger: 0.07, delayChildren: 0 })

export function RevealGroup({ children, style, className, stagger = 0.07, delayChildren = 0 }: {
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
    <div className={className} style={{ ...style, ...revealStyle(inView, 18, delayChildren + _i * stagger) }}>
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
  return <div style={{ ...style, ...revealStyle(shown, y, delay, 0.6) }}>{children}</div>
}
