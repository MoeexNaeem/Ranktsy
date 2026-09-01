'use client'
/**
 * Guided product tour for the dashboard, built on Driver.js (bundled, not CDN, so it
 * passes our CSP). Runs once automatically on a user's first visit (remembered in
 * localStorage) and can be replayed any time via the "Take a tour" button, which
 * dispatches the `rankkw:start-tour` event this component listens for.
 */
import { useEffect, useRef, useCallback } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const STORAGE_KEY = 'rankkw_dashboard_tour_v1'

const STEPS = [
  { element: '[data-tour="tool-search"]', popover: { title: 'Find any tool fast', description: 'Type part of a tool’s name to jump straight to it. Rankkw has 30+ tools.' } },
  { element: '[data-tour="nav"]',         popover: { title: 'Your toolkit', description: 'Every tool, grouped by what it does: Research, Shop Insights, Optimize and Tools.' } },
  { element: '[data-tour="tool-keywords"]', popover: { title: 'Start with Keywords', description: 'Real Google search volume and Etsy signals for any keyword, in any country.' } },
  { element: '[data-tour="credits"]',     popover: { title: 'Your daily credits', description: 'The heavier tools spend credits (10 per use). Your balance resets every day.' } },
  { element: '[data-tour="upgrade"]',     popover: { title: 'Unlock more', description: 'Upgrade any time for higher limits, AI listing images and the full toolkit.' } },
  { element: '[data-tour="content"]',     popover: { title: 'Your workspace', description: 'Whatever tool you pick opens right here. That is the whole tour, enjoy Rankkw.' } },
]

const TOUR_CSS = `
.rankkw-tour.driver-popover {
  background: #F6F4EC; color: #3D3E3B; border-radius: 14px; max-width: 322px;
  padding: 18px 18px 14px; box-shadow: 0 18px 50px rgba(20,18,14,0.28); font-family: inherit;
}
.rankkw-tour .driver-popover-title { font-size: 16px; font-weight: 600; color: #2b2c29; margin-bottom: 6px; }
.rankkw-tour .driver-popover-description { font-size: 13.5px; line-height: 1.55; color: #57574f; }
.rankkw-tour .driver-popover-progress-text { font-size: 11px; color: #9a9a90; font-family: monospace; }
.rankkw-tour .driver-popover-close-btn { color: #9a9a90; font-size: 20px; }
.rankkw-tour .driver-popover-navigation-btns button {
  background: transparent; color: #57574f; border: 1px solid #dcd8cc; border-radius: 100px;
  padding: 6px 14px; font-size: 13px; font-weight: 500; text-shadow: none;
}
.rankkw-tour .driver-popover-navigation-btns button.driver-popover-next-btn {
  background: #FB5E09; color: #fff; border-color: #FB5E09;
}
.rankkw-tour .driver-popover-arrow-side-left.driver-popover-arrow  { border-left-color: #F6F4EC; }
.rankkw-tour .driver-popover-arrow-side-right.driver-popover-arrow { border-right-color: #F6F4EC; }
.rankkw-tour .driver-popover-arrow-side-top.driver-popover-arrow    { border-top-color: #F6F4EC; }
.rankkw-tour .driver-popover-arrow-side-bottom.driver-popover-arrow { border-bottom-color: #F6F4EC; }
`

export function DashboardTour() {
  const ref = useRef<ReturnType<typeof driver> | null>(null)

  const start = useCallback(() => {
    try { ref.current?.destroy() } catch { /* ignore */ }
    // Only include steps whose target is actually on the page right now.
    const steps = STEPS.filter(s => document.querySelector(s.element))
    if (!steps.length) return
    const d = driver({
      showProgress: true,
      overlayColor: 'rgba(20,18,14,0.55)',
      stagePadding: 6,
      stageRadius: 12,
      popoverClass: 'rankkw-tour',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps,
    })
    ref.current = d
    d.drive()
  }, [])

  // First-visit auto-run, after the dashboard has painted.
  useEffect(() => {
    let seen = false
    try { seen = !!localStorage.getItem(STORAGE_KEY) } catch { /* ignore */ }
    if (seen) return
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
      start()
    }, 1300)
    return () => clearTimeout(t)
  }, [start])

  // Replay when the "Take a tour" button fires the event.
  useEffect(() => {
    const h = () => start()
    window.addEventListener('rankkw:start-tour', h)
    return () => {
      window.removeEventListener('rankkw:start-tour', h)
      try { ref.current?.destroy() } catch { /* ignore */ }
    }
  }, [start])

  return <style>{TOUR_CSS}</style>
}
