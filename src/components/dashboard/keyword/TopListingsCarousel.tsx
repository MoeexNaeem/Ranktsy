'use client'
/**
 * The top-ranking listings for a keyword, as a swipeable card deck.
 *
 * Same sample the Listings table works from, but scannable: one card per listing,
 * ranked in Etsy's own order, so a seller can flip through what is winning without
 * reading a wide table. Every number here is a real Etsy field or a ratio of two
 * (views / age, favourites / views); nothing is estimated.
 *
 * SCROLL PERFORMANCE: a deck of 100 cards is re-rendered on every state change, so
 * the scroll handler is the one thing that must stay cheap. Four things keep it
 * smooth: the per-card work is precomputed once (not per render), each card is its
 * own memo component (so a parent re-render skips all 100 subtrees), the scroll
 * handler is coalesced to one animation frame, and the card pitch is measured once
 * and cached rather than re-read per frame. That last one matters most: measuring it
 * live meant a querySelectorAll over all 100 cards plus a forced synchronous layout
 * on every single scroll frame, the classic source of scroll jank.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { C, D, formatNumber } from '@/utils'
import { MONO } from '../kit'
import type { EtsyListing } from '@/types'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: '₨', INR: '₹', JPY: '¥' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? `${c} ` : '$')

const CARD_W = 236
// Fallback pitch only. The live value is measured from the rendered cards, so a
// change to the card width or the CSS gap can never desync the paging maths.
const STEP_FALLBACK = CARD_W + 14

/** Distance from one card's left edge to the next, measured off the real DOM.
 *  Call this sparingly: it forces a layout. */
function measurePitch(el: HTMLElement | null): number {
  const first = el?.firstElementChild
  const second = first?.nextElementSibling
  if (!first || !second) return STEP_FALLBACK
  const gap = second.getBoundingClientRect().left - first.getBoundingClientRect().left
  return gap > 1 ? gap : STEP_FALLBACK
}

function ExtIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-1px' }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
}

function Arrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button aria-label={dir === 'prev' ? 'Previous listings' : 'Next listings'} onClick={onClick} disabled={disabled}
      style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.ash}`, background: C.paper, color: disabled ? C.ash : C.ink, cursor: disabled ? 'default' : 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, opacity: disabled ? 0.5 : 1, transition: 'opacity 0.15s' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: dir === 'prev' ? 'rotate(180deg)' : 'none' }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

/** One metric inside a card. */
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 9.5, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, whiteSpace: 'nowrap' }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color, margin: '2px 0 0', lineHeight: 1.2 }}>{value}</p>
    </div>
  )
}

/** Everything a card shows, worked out once per listing rather than per render. */
interface CardData {
  id: number
  rank: number
  title: string
  shop: string
  url: string
  image: string | null
  price: string | null
  age: string
  views: string
  perDay: string
  fpv: string
  fpvColor: string
}

function build(listings: EtsyListing[], nowSec: number): CardData[] {
  return listings.map((l, i) => {
    const ageDays = l.created_timestamp ? Math.max(Math.floor((nowSec - l.created_timestamp) / 86400), 0) : null
    const views = l.views ?? 0
    const favs = l.num_favorers ?? 0
    const perDay = ageDays && ageDays > 0 ? views / ageDays : null
    const fpv = views > 0 ? (favs / views) * 100 : null
    const price = l.price.amount / (l.price.divisor || 100)
    return {
      id: l.listing_id,
      rank: i + 1,
      title: l.title,
      shop: l.shop_name,
      url: l.url,
      image: l.images?.[0]?.url_570xN || null,
      price: price > 0 ? `${sym(l.price.currency_code)}${price.toFixed(2)}` : null,
      age: ageDays != null ? formatNumber(ageDays) : '-',
      views: formatNumber(views),
      perDay: perDay != null ? perDay.toFixed(1) : '-',
      fpv: fpv != null ? `${fpv.toFixed(1)}%` : '-',
      fpvColor: fpv == null ? C.ink : fpv >= 4 ? D.good : fpv >= 1.5 ? D.mid : C.ink,
    }
  })
}

// memo + a stable `d` object means a parent re-render (the position counter
// ticking over) re-renders none of these.
const ListingCard = memo(function ListingCard({ d, pending }: { d: CardData; pending: boolean }) {
  return (
    <article style={{ flex: `0 0 ${CARD_W}px`, width: CARD_W, scrollSnapAlign: 'start', border: `1px solid ${C.hair}`, borderRadius: 14, background: C.paper, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', background: C.bone }}>
        {d.image
          ? <img src={d.image} alt="" loading="lazy" decoding="async" width={CARD_W} height={150}
              style={{ display: 'block', width: '100%', height: 150, objectFit: 'cover' }} />
          // Etsy serves listing images from a second call, so the deck paints
          // before they arrive. Pulse while they are on the way, stay flat if the
          // listing genuinely has no photo.
          : <div className={pending ? 'shimmer' : undefined} style={{ width: '100%', height: 150 }} />}
        <span style={{ position: 'absolute', top: 8, left: 8, minWidth: 22, height: 22, padding: '0 7px', borderRadius: 999, background: d.rank <= 3 ? C.orange : 'rgba(20,18,14,0.72)', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: MONO, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {d.rank}
        </span>
        {d.price && (
          <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(255,255,255,0.94)', color: C.ink, fontSize: 12, fontWeight: 700, fontFamily: MONO, padding: '3px 9px', borderRadius: 999, border: `1px solid ${C.hair}` }}>
            {d.price}
          </span>
        )}
      </div>

      <div style={{ padding: '11px 13px 13px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        <p title={d.title} style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, lineHeight: 1.38, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {d.title}
        </p>
        <p style={{ fontSize: 11, color: C.graphite, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.shop}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 10px', marginTop: 'auto', paddingTop: 4 }}>
          <Stat label="Age (days)" value={d.age} color={C.ink} />
          <Stat label="Views" value={d.views} color="#2E6DB4" />
          <Stat label="Views / day" value={d.perDay} color="#2E6DB4" />
          <Stat label="Favs / view" value={d.fpv} color={d.fpvColor} />
        </div>

        <a href={d.url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: C.orange, textDecoration: 'none', marginTop: 2 }}>
          See on Etsy <ExtIcon />
        </a>
      </div>
    </article>
  )
})

export const TopListingsCarousel = memo(function TopListingsCarousel({ listings, imagesPending = false }: { listings: EtsyListing[]; imagesPending?: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [current, setCurrent] = useState(1)
  // Captured once so a card's age does not drift between re-renders.
  const [nowSec] = useState(() => Date.now() / 1000)

  const cards = useMemo(() => build(listings, nowSec), [listings, nowSec])

  // One pending frame at a time: a wheel or drag fires scroll far faster than the
  // screen refreshes, and each extra pass would be a wasted render.
  const frame = useRef(0)
  // Cached card pitch. 0 means "not measured yet"; a resize clears it.
  const pitch = useRef(0)
  const getPitch = useCallback(() => {
    if (!pitch.current) pitch.current = measurePitch(track.current)
    return pitch.current
  }, [])

  const read = useCallback(() => {
    frame.current = 0
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setAtStart(el.scrollLeft < 8)
    setAtEnd(el.scrollLeft >= max - 8)
    setCurrent(Math.min(cards.length, Math.round(el.scrollLeft / getPitch()) + 1))
  }, [cards.length, getPitch])

  const onScroll = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(read)
  }, [read])

  // Settle the arrows on mount (a deck narrower than its container never scrolls),
  // re-measure when the deck is resized, and drop any queued frame on unmount.
  useEffect(() => {
    pitch.current = 0
    read()
    const el = track.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { pitch.current = 0; read() })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [read])

  const page = useCallback((dir: number) => {
    const el = track.current
    if (!el) return
    // Move by whole cards, a viewport at a time, so nothing lands half-cut.
    const step = getPitch()
    const perView = Math.max(1, Math.floor(el.clientWidth / step))
    el.scrollBy({ left: dir * perView * step, behavior: 'smooth' })
  }, [getPitch])

  if (!cards.length) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <p style={{ fontSize: 12.5, color: C.graphite, margin: 0, flex: 1, lineHeight: 1.55 }}>
          The listings currently ranking for this keyword, in Etsy&rsquo;s own order. Flip through to see what is winning.
        </p>
        <span style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone, whiteSpace: 'nowrap' }}>{current} / {cards.length}</span>
        <Arrow dir="prev" disabled={atStart} onClick={() => page(-1)} />
        <Arrow dir="next" disabled={atEnd} onClick={() => page(1)} />
      </div>

      <div ref={track} className="tlc-track" onScroll={onScroll}>
        {cards.map(d => <ListingCard key={d.id} d={d} pending={imagesPending} />)}
      </div>
    </div>
  )
})
