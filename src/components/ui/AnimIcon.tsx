'use client'
/**
 * AnimIcon - an animated Lordicon that MOVES on hover and when it becomes the
 * active item, then rests (never loops constantly). Colour is caller-controlled
 * so an icon keeps the same hue it had as a static SVG.
 *
 * Uses Lordicon's free CDN web component (<lord-icon>), loaded once, lazily. The
 * element is created via React.createElement so we don't need a JSX intrinsic
 * declaration for the custom element.
 */
import React, { useEffect, useRef, useState } from 'react'

// Load the Lordicon custom-element script exactly once per page.
let loader: Promise<boolean> | null = null
function loadLordicon(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (customElements.get('lord-icon')) return Promise.resolve(true)
  if (loader) return loader
  loader = new Promise<boolean>((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.lordicon.com/lordicon.js'
    s.async = true
    s.onload = () => resolve(!!customElements.get('lord-icon'))
    s.onerror = () => resolve(false)   // fail-soft: we just render a plain box
    document.head.appendChild(s)
  })
  return loader
}

export type IconTrigger = 'hover' | 'loop' | 'morph' | 'boomerang' | 'in' | 'sequence'

interface AnimIconProps {
  /** Lordicon CDN JSON url, e.g. https://cdn.lordicon.com/jeuxydnh.json */
  src: string
  size?: number
  /** Primary colour - pass the icon's existing hue to keep the look unchanged. */
  color?: string
  /** When this flips true (e.g. a tab becomes active) the icon plays once. */
  active?: boolean
  /** How motion is triggered by interaction. Default 'hover' = one play per hover. */
  trigger?: IconTrigger
  /** CSS selector of an ancestor to watch for the trigger instead of the icon
   * itself - e.g. "button" so hovering the whole nav tab / card plays the icon. */
  target?: string
  style?: React.CSSProperties
}

export function AnimIcon({ src, size = 22, color, active, trigger = 'hover', target, style }: AnimIconProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => { let alive = true; loadLordicon().then(ok => alive && setReady(ok)); return () => { alive = false } }, [])

  // Play once whenever `active` becomes true (the player attaches a moment after
  // mount, so retry briefly).
  useEffect(() => {
    if (!active || !ready) return
    const play = () => ref.current?.playerInstance?.playFromBeginning?.()
    play()
    const t = setTimeout(play, 150)
    return () => clearTimeout(t)
  }, [active, ready])

  // Before the CDN resolves, reserve the space so there's no layout shift.
  if (!ready) return <span style={{ display: 'inline-block', width: size, height: size, ...style }} />

  return React.createElement('lord-icon', {
    ref,
    src,
    trigger,
    ...(target ? { target } : {}),
    ...(color ? { colors: `primary:${color}` } : {}),
    style: { width: size, height: size, display: 'block', ...style },
  })
}

// Curated, verified free Lordicon icons (CDN 200-checked; names read from the
// Lottie `nm`). Centralised so the same icon is reused and swapped in one place.
export const ICON = {
  home:      'https://cdn.lordicon.com/jeuxydnh.json', // home
  account:   'https://cdn.lordicon.com/kthelypq.json', // account / user
  coins:     'https://cdn.lordicon.com/qhviklyi.json', // coins (money)
  book:      'https://cdn.lordicon.com/wxnxiano.json', // book
  settings:  'https://cdn.lordicon.com/lecprnjb.json', // settings cog
  search:    'https://cdn.lordicon.com/kkvxgpti.json', // magnifier search
  magnifier: 'https://cdn.lordicon.com/msoeawqm.json', // magnifier (alt)
  globe:     'https://cdn.lordicon.com/gqzfzudq.json', // globe / map
  build:     'https://cdn.lordicon.com/pflszboa.json', // build / wrench (optimize)
  basket:    'https://cdn.lordicon.com/slkvcfos.json', // shopping basket
  shopping:  'https://cdn.lordicon.com/mfmkufkr.json', // shopping bag
  document:  'https://cdn.lordicon.com/nocovwne.json', // document
  celebration:'https://cdn.lordicon.com/tyvtvbcy.json',// celebration (winners/events)
  eye:       'https://cdn.lordicon.com/vfczflna.json', // eye (inspect)
  chat:      'https://cdn.lordicon.com/fdxqrdfe.json', // chat
  demand:    'https://cdn.lordicon.com/fqbvgezn.json', // demand (trend/hot)
  trending:  'https://cdn.lordicon.com/vduvxizq.json', // trending-up
  gift:      'https://cdn.lordicon.com/xhbsnkyp.json', // gift / package
  display:   'https://cdn.lordicon.com/qhgmphtg.json', // computer display
  addCard:   'https://cdn.lordicon.com/hqymfzvj.json', // add card (ads)
  consult:   'https://cdn.lordicon.com/zpxybbhl.json', // consultation (AI helper)
  check:     'https://cdn.lordicon.com/oqdmuxru.json', // check (audit/spell)
  barChart:  'https://cdn.lordicon.com/abwrkdvl.json', // bar chart
  target:    'https://cdn.lordicon.com/iltqorsz.json', // target (rank/gap)
} as const

// Dashboard tab id → animated icon. One place to retune any tab's icon.
export const DASH_ICON: Record<string, string> = {
  overview: ICON.home, myshop: ICON.shopping, hotproducts: ICON.demand,
  keywords: ICON.search, gap: ICON.target, listings: ICON.display,
  competitors: ICON.account, compsales: ICON.coins, trends: ICON.trending,
  buzz: ICON.demand, monthly: ICON.barChart, topsellers: ICON.celebration,
  catreport: ICON.barChart, bulk: ICON.magnifier, rank: ICON.target,
  shop: ICON.globe, salesmap: ICON.globe, delivery: ICON.gift,
  tags: ICON.build, titlegen: ICON.document, taggen: ICON.build,
  descgen: ICON.book, listingpro: ICON.display, aihelper: ICON.consult,
  audit: ICON.check, ctags: ICON.build, compare: ICON.display,
  spell: ICON.check, fees: ICON.coins, adsroi: ICON.addCard,
  category: ICON.book, calendar: ICON.celebration, lists: ICON.document,
}
