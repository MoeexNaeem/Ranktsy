'use client'
/** Find Hot Products, My products: the user's favorites and tracked products with their latest measured numbers. */
import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { C, D, ACCENT, withAlpha, formatNumber } from '@/utils'
import { Card, SectionTitle, Loading, EmptyState, MONO } from '../kit'
import { dbToHot } from './ProductDatabase'
import { useSaved, useToggleSaved } from './useSaved'
import type { HotProduct, SavedItem } from '@/types'

const HUE = ACCENT.rose
const g = (v: number | null | undefined, est = false) => (v == null ? '-' : `${est ? '~' : '+'}${formatNumber(v)}`)

export function MyProducts({ onOpen }: { onOpen: (p: HotProduct) => void }) {
  const [kind, setKind] = useState<'fav' | 'track'>('track')
  const q = useSaved(kind, true)
  const toggle = useToggleSaved()
  const items = q.data ?? []
  const open = (s: SavedItem) => {
    if (s.product) return onOpen(dbToHot(s.product))
    onOpen({ listing_id: s.listingId!, title: s.title ?? '', url: `https://www.etsy.com/listing/${s.listingId}`, image: s.image ?? null, price: null, currency: 'USD', views: 0, favorites: 0, engagementPct: 0, favPerDay: null, hotScore: 0, tags: [], shopName: '', createdTimestamp: null, quantity: 0 })
  }
  const pill = (on: boolean): React.CSSProperties => ({ fontSize: 13.5, padding: '7px 16px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', background: on ? withAlpha(HUE, 0.12) : 'transparent', color: on ? HUE : C.graphite, border: `1px solid ${on ? HUE : C.ash}` })
  return (
    <Card pad={0}>
      <div style={{ padding: '16px 18px 12px' }}>
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>{items.length} saved</span>}>My products</SectionTitle>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setKind('track')} style={pill(kind === 'track')}>◎ Tracking</button>
          <button onClick={() => setKind('fav')} style={pill(kind === 'fav')}>♥ Favorites</button>
          <span style={{ fontSize: 12, color: C.graphite, marginLeft: 6 }}>
            {kind === 'track' ? 'We read tracked products from Etsy every day, so their history has no gaps.' : 'Products you starred to come back to.'}
          </span>
        </div>
      </div>
      {q.isPending ? <div style={{ padding: 18 }}><Loading label="Loading your products…" /></div>
        : items.length === 0 ? <div style={{ padding: 18 }}><EmptyState icon={kind === 'track' ? '🎯' : '♡'} title={kind === 'track' ? 'No tracked products yet' : 'No favorites yet'} sub="Use the ◎ and ♡ buttons on any product in the database, the charts or a product page." /></div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,2.4fr) repeat(4, minmax(90px,1fr)) 80px', gap: 10, padding: '10px 18px', background: C.headerBg, borderTop: `1px solid ${C.ash}`, borderBottom: `1px solid ${C.ash}` }}>
                {['Product', 'Sales · 7d', 'Favorites · 7d', 'Views · 7d', 'Best rank', ''].map((h, i) => <span key={h || i} style={{ fontSize: 10.5, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', color: C.graphite, textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>)}
              </div>
              {items.map(s => {
                const p = s.product
                return (
                  <div key={s.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,2.4fr) repeat(4, minmax(90px,1fr)) 80px', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${C.hair}`, alignItems: 'center' }}>
                    <button onClick={() => open(s)} style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      {(p?.image ?? s.image) ? <img src={(p?.image ?? s.image)!} alt="" style={{ width: 56, height: 56, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 56, height: 56, borderRadius: 9, background: C.bone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="image" size={18} color={C.stone} /></div>}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, color: C.ink, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p?.title || s.title || `Listing ${s.listingId}`}</p>
                        <p style={{ fontSize: 11, color: C.stone, marginTop: 2 }}>{p ? `measured ${p.lastDay}` : 'not in the database yet: measured from tomorrow'}</p>
                      </div>
                    </button>
                    <span style={{ fontSize: 13.5, fontFamily: MONO, textAlign: 'right', color: p?.sales7 == null ? C.stone : p.salesEst ? D.mid : D.good }}>{g(p?.sales7, p?.salesEst)}</span>
                    <span style={{ fontSize: 13.5, fontFamily: MONO, textAlign: 'right', color: p?.f7 == null ? C.stone : D.good }}>{g(p?.f7)}</span>
                    <span style={{ fontSize: 13.5, fontFamily: MONO, textAlign: 'right', color: p?.v7 == null ? C.stone : D.good }}>{g(p?.v7)}</span>
                    <span style={{ fontSize: 13.5, fontFamily: MONO, textAlign: 'right', color: p?.bestRank == null ? C.stone : C.ink }}>{p?.bestRank != null ? `#${p.bestRank}` : '-'}</span>
                    <button onClick={() => toggle.mutate({ kind, on: false, listingId: s.listingId })} title="Remove"
                      style={{ justifySelf: 'end', background: 'none', border: `1px solid ${C.ash}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: C.graphite, fontFamily: 'inherit' }}>Remove</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
    </Card>
  )
}
