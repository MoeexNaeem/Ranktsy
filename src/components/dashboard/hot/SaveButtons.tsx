'use client'
/** Favorite (♥) and Track (◎) toggles for one product, compact or labelled. */
import { C, ACCENT, withAlpha } from '@/utils'
import { useSavedIds, useToggleSaved } from './useSaved'

const HUE = ACCENT.rose

export function SaveButtons({ listingId, title, image, shopId, labelled = false }: {
  listingId: number; title?: string; image?: string | null; shopId?: number; labelled?: boolean
}) {
  const favs = useSavedIds('fav')
  const tracked = useSavedIds('track')
  const toggle = useToggleSaved()
  const isFav = favs.has(listingId)
  const isTracked = tracked.has(listingId)
  const btn = (on: boolean): React.CSSProperties => labelled
    ? { height: 42, padding: '0 16px', borderRadius: 28, border: `1px solid ${on ? HUE : C.ash}`, background: on ? withAlpha(HUE, 0.1) : C.paper, color: on ? HUE : C.ink, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
    : { width: 30, height: 30, borderRadius: 8, border: `1px solid ${on ? HUE : C.ash}`, background: on ? withAlpha(HUE, 0.1) : C.paper, color: on ? HUE : C.graphite, cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
  const base = { listingId, title, image, shopId }
  return (
    <>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggle.mutate({ kind: 'fav', on: !isFav, ...base }) }} disabled={toggle.isPending}
        title={isFav ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={isFav} style={btn(isFav)}>
        {isFav ? '♥' : '♡'}{labelled ? (isFav ? ' Favorited' : ' Add to favorites') : ''}
      </button>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggle.mutate({ kind: 'track', on: !isTracked, ...base }) }} disabled={toggle.isPending}
        title={isTracked ? 'Stop tracking' : 'Track daily: we measure it every day'} aria-pressed={isTracked} style={btn(isTracked)}>
        {isTracked ? '◉' : '◎'}{labelled ? (isTracked ? ' Tracking' : ' Track daily') : ''}
      </button>
    </>
  )
}
