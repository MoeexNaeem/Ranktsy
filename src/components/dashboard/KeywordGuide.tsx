'use client'
/**
 * Keyword Search guide: a plain-English glossary of every stat plus a Driver.js
 * walkthrough of the tool. Built on the same bundled Driver.js (not CDN, so it
 * passes our CSP) as the dashboard tour. Rendered at the top of Keyword Search;
 * the tour targets elements tagged with data-tour="kw-*" and only shows the steps
 * whose target is on the page right now (so it works before or after a search).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { C } from '@/utils'
import { MONO } from '@/components/dashboard/kit'

// Every stat the tool shows, explained in very simple English (no jargon).
const GLOSSARY: { term: string; body: string }[] = [
  { term: 'Keyword Difficulty (KD)', body: 'How hard it is to reach the first page for this keyword. It is a score from 0 to 100, where lower is easier. We work it out from how many listings compete and how much shoppers engage with them. Easy means you have a real chance, Hard means big sellers dominate.' },
  { term: 'Competition', body: 'How many live Etsy listings are selling for this exact keyword right now. More listings means more sellers you are up against. This is a real count from Etsy, not a guess.' },
  { term: 'Search Volume', body: 'The real average number of times people search this keyword on Google each month, for the country you picked. Etsy does not share its own search numbers, so we use Google to show genuine demand.' },
  { term: 'Ad Competition', body: 'How hard advertisers fight to show ads for this keyword on Google. It is shown as Low, Medium or High. This is about Google ads, not about Etsy listings.' },
  { term: 'CPC (Cost Per Click)', body: 'The typical price an advertiser pays for one click on this keyword in Google Ads. A higher CPC usually means the keyword makes money for sellers.' },
  { term: 'Avg. Views', body: 'The average number of lifetime views on the listings that rank for this keyword. It shows how much traffic these products get on Etsy.' },
  { term: 'Avg. Favorites', body: 'The average number of favorites (hearts) on those listings. It shows how much shoppers like these products.' },
  { term: 'Favs / View', body: 'Favorites divided by views, shown as a percent. It tells you how many viewers cared enough to save the item. Around 1 to 3 percent is normal, and higher means stronger interest.' },
  { term: 'Avg. Price', body: 'The average selling price of the listings that rank for this keyword, shown in the currency of the country you chose.' },
  { term: 'Best Keyword Opportunities', body: 'Your related keywords sorted from best to worst target. A longer bar is a better keyword to go after: real demand that you can realistically rank for.' },
  { term: 'Related keywords', body: 'Other keywords connected to your search, each with its own numbers, so you can spot easier or better options.' },
  { term: 'Near matches', body: 'Small spelling or wording variations of your keyword, measured on their own so you do not miss a better phrasing.' },
]

const STEPS = [
  { element: '[data-tour="kw-search"]', popover: { title: 'Search any keyword', description: 'Type a keyword, pick a country, and press Enter. We pull real Etsy and Google data just for that keyword.' } },
  { element: '[data-tour="kw-help"]', popover: { title: 'Confused by a number?', description: 'Open this Help button any time for a plain-English guide to every stat.' } },
  { element: '[data-tour="kw-stats"]', popover: { title: 'Keyword Statistics', description: 'The core numbers, grouped by where they come from: Google (real search demand) and Etsy (real listing signals).' } },
  { element: '[data-tour="kw-kd"]', popover: { title: 'Difficulty and Search Volume', description: 'How hard it is to rank (KD, lower is easier) and how many people search it each month.' } },
  { element: '[data-tour="kw-opportunities"]', popover: { title: 'Best Opportunities', description: 'Your related keywords ranked best to worst, so you know exactly where to aim.' } },
  { element: '[data-tour="kw-subtabs"]', popover: { title: 'Go deeper', description: 'Related ideas, near matches, a full search analysis, and the top listings for your keyword.' } },
]

const TOUR_CSS = `
.rankkw-tour.driver-popover { background: #F6F4EC; color: #3D3E3B; border-radius: 14px; max-width: 322px; padding: 18px 18px 14px; box-shadow: 0 18px 50px rgba(20,18,14,0.28); font-family: inherit; }
.rankkw-tour .driver-popover-title { font-size: 16px; font-weight: 600; color: #2b2c29; margin-bottom: 6px; }
.rankkw-tour .driver-popover-description { font-size: 13.5px; line-height: 1.55; color: #57574f; }
.rankkw-tour .driver-popover-progress-text { font-size: 11px; color: #9a9a90; font-family: monospace; }
.rankkw-tour .driver-popover-close-btn { color: #9a9a90; font-size: 20px; }
.rankkw-tour .driver-popover-navigation-btns button { background: transparent; color: #57574f; border: 1px solid #dcd8cc; border-radius: 100px; padding: 6px 14px; font-size: 13px; font-weight: 500; text-shadow: none; }
.rankkw-tour .driver-popover-navigation-btns button.driver-popover-next-btn { background: #FB5E09; color: #fff; border-color: #FB5E09; }
.rankkw-tour .driver-popover-arrow-side-left.driver-popover-arrow { border-left-color: #F6F4EC; }
.rankkw-tour .driver-popover-arrow-side-right.driver-popover-arrow { border-right-color: #F6F4EC; }
.rankkw-tour .driver-popover-arrow-side-top.driver-popover-arrow { border-top-color: #F6F4EC; }
.rankkw-tour .driver-popover-arrow-side-bottom.driver-popover-arrow { border-bottom-color: #F6F4EC; }
`

export function KeywordGuide() {
  const [open, setOpen] = useState(false)
  const ref = useRef<ReturnType<typeof driver> | null>(null)

  const startTour = useCallback(() => {
    try { ref.current?.destroy() } catch { /* ignore */ }
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

  // Close the glossary on Escape; clean up the tour on unmount.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      try { ref.current?.destroy() } catch { /* ignore */ }
    }
  }, [])

  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 15px', borderRadius: 100,
    border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 13, fontWeight: 500,
    fontFamily: 'inherit', cursor: 'pointer',
  }

  return (
    <>
      <style>{TOUR_CSS}</style>

      {/* Header row with the Help + Tour buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em', margin: 0 }}>Keyword Search</h2>
          <p style={{ fontSize: 12.5, color: C.graphite, margin: 0 }}>Real Etsy and Google data for any keyword, in any country.</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button data-tour="kw-help" onClick={() => setOpen(true)} style={pill} aria-label="What do these stats mean?">
            <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 17, height: 17, borderRadius: '50%', border: `1.4px solid ${C.orange}`, color: C.orange, fontSize: 11, fontStyle: 'italic', fontWeight: 700 }}>i</span>
            What do these stats mean?
          </button>
          <button onClick={startTour} style={{ ...pill, background: C.orange, color: '#fff', border: `1px solid ${C.orange}` }}>
            ▶ Take a tour
          </button>
        </div>
      </div>

      {/* Glossary modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,18,14,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{ width: 'min(680px, 100%)', background: C.paper, borderRadius: 16, boxShadow: '0 24px 70px rgba(20,18,14,0.32)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '20px 24px', borderBottom: `1px solid ${C.ash}` }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, margin: 0 }}>What do these stats mean?</h3>
                <p style={{ fontSize: 12.5, color: C.graphite, margin: '4px 0 0' }}>A plain-English guide to every number in Keyword Search.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close"
                style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 18, lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '10px 24px 24px', maxHeight: '62vh', overflowY: 'auto' }}>
              {GLOSSARY.map(g => (
                <div key={g.term} style={{ padding: '16px 0', borderBottom: `1px solid ${C.hair ?? C.ash}` }}>
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: C.orange, margin: '0 0 5px', fontFamily: MONO }}>{g.term}</p>
                  <p style={{ fontSize: 13.5, color: '#4a4a46', lineHeight: 1.65, margin: 0 }}>{g.body}</p>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 18 }}>
                <button onClick={() => { setOpen(false); startTour() }}
                  style={{ height: 40, padding: '0 18px', borderRadius: 100, border: 'none', background: C.orange, color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  ▶ Show me around instead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
