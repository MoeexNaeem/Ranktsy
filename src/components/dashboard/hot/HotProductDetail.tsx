'use client'
/**
 * Find Hot Products — product detail. Opens from a database row and pulls the
 * full live listing + its shop's real record, an AI read, and a per-tag analysis
 * (real competition/views/favorites/Google). Every tag and the shop are
 * clickable → they fetch fresh real data. No sales/revenue is shown or invented
 * — Etsy publishes none per listing.
 */
import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/app'
import { C, D, formatNumber, withAlpha, ACCENT } from '@/utils'
import { Card, SectionTitle, Loading, MONO, primaryBtn } from '../kit'
import { AiInsights } from '../AiInsights'
import type { HotProduct, EtsyListing, AiFact, ApiResponse, BulkKeywordRow } from '@/types'

const HUE = ACCENT.rose   // Hot Products' accent

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', NZD: 'NZ$', JPY: '¥' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? ((c ?? '') + ' ')
const fmtDate = (ts?: number | null) => ts ? new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

function Metric({ label, value, sub, color = C.ink }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.bone, borderRadius: 12, padding: '12px 14px' }}>
      <p style={{ fontSize: 10.5, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11.5, color: C.graphite, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

export function HotProductDetail({ product, onBack, onNavigate }: {
  product: HotProduct; onBack: () => void; onNavigate?: (id: string) => void
}) {
  const [activeImg, setActiveImg] = useState(0)

  // Full live listing — description, all images, quantity, taxonomy.
  const listingQ = useQuery({
    queryKey: ['hot-listing', product.listing_id],
    queryFn: async () => (await axios.get(`/api/etsy/listing?id=${product.listing_id}`)).data.data as EtsyListing,
    staleTime: 1000 * 60 * 30, retry: false,
  })
  // The shop's real record (lifetime sales, rating, reviews).
  const shopQ = useQuery({
    queryKey: ['hot-shop', product.shopName],
    queryFn: async () => (await axios.get(`/api/etsy/shop?id=${encodeURIComponent(product.shopName)}`)).data.data as { shop: Record<string, unknown> },
    enabled: !!product.shopName, staleTime: 1000 * 60 * 15, retry: false,
  })
  const shop = shopQ.data?.shop
  const listing = listingQ.data

  const images = listing?.images?.length ? listing.images : (product.image ? [{ url_570xN: product.image, url_75x75: product.image }] : [])
  const shopSales = shop?.sales != null ? Number(shop.sales) : null
  const shopRating = Number(shop?.review_average ?? 0)
  const shopReviews = Number(shop?.review_count ?? 0)

  // Per-tag analysis — real competition/views/favorites/Google, on demand.
  const tagAnalysis = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post<ApiResponse<BulkKeywordRow[]>>('/api/keywords/bulk', { keywords: product.tags })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
  })

  const aiFacts = useMemo<AiFact[]>(() => {
    const f: AiFact[] = [
      { label: 'Views', value: formatNumber(product.views), hint: 'lifetime' },
      { label: 'Favorites', value: formatNumber(product.favorites) },
      { label: 'Engagement', value: `${product.engagementPct}%`, hint: 'favorites ÷ views; ~1–3% typical' },
      { label: 'Hot Score', value: `${product.hotScore}/100`, hint: 'favorite-velocity + engagement' },
    ]
    if (product.favPerDay != null) f.push({ label: 'Favorites/day', value: String(product.favPerDay), hint: 'accrual rate for its age' })
    if (product.price != null) f.push({ label: 'Price', value: `${sym(product.currency)}${product.price}` })
    if (product.createdTimestamp) f.push({ label: 'Released', value: fmtDate(product.createdTimestamp) })
    if (shopSales != null) f.push({ label: 'Shop lifetime sales', value: formatNumber(shopSales), hint: 'shop-wide, real' })
    if (shopReviews) f.push({ label: 'Shop rating', value: `${shopRating.toFixed(2)}★`, hint: `${formatNumber(shopReviews)} reviews` })
    if (product.tags[0]) f.push({ label: 'Top tag', value: product.tags[0] })
    return f
  }, [product, shopSales, shopRating, shopReviews])

  // Clicking a tag seeds the Keyword tool with it and jumps there — real new data.
  const researchTag = useCallback((tag: string) => {
    useAppStore.getState().setActiveKeyword(tag)
    onNavigate?.('keywords')
  }, [onNavigate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Back */}
      <button onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', color: C.graphite, fontSize: 13.5, fontFamily: 'inherit', padding: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Back to products
      </button>

      {/* Header: gallery + core */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 16, alignItems: 'start' }}>
        <Card pad="16px">
          <div style={{ borderRadius: 12, overflow: 'hidden', background: C.bone, aspectRatio: '1 / 1' }}>
            {images[activeImg]?.url_570xN
              ? <img src={images[activeImg].url_570xN} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: C.stone }}>🛍</div>}
          </div>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {images.slice(0, 6).map((im, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', border: `2px solid ${i === activeImg ? HUE : 'transparent'}`, padding: 0, cursor: 'pointer', background: C.bone, flexShrink: 0 }}>
                  <img src={im.url_75x75 || im.url_570xN} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 600, color: C.ink, lineHeight: 1.35, letterSpacing: '-0.01em' }}>{product.title}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {product.price != null && <span style={{ fontSize: 22, fontWeight: 600, color: HUE }}>{sym(product.currency)}{product.price}</span>}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontFamily: MONO, fontWeight: 600, color: HUE, background: withAlpha(HUE, 0.12), padding: '4px 11px', borderRadius: 100 }}>
                🔥 Hot {product.hotScore}
              </span>
              {product.shopName && <span style={{ fontSize: 13, color: C.graphite }}>by {product.shopName}</span>}
            </div>
          </div>

          {/* Real metrics */}
          <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            <Metric label="Views" value={formatNumber(product.views)} sub="lifetime" color={D.series[1]} />
            <Metric label="Favorites" value={formatNumber(product.favorites)} color={D.series[5]} />
            <Metric label="Engagement" value={`${product.engagementPct}%`} sub="favs ÷ views" color={D.series[4]} />
            <Metric label="Fav / day" value={product.favPerDay != null ? String(product.favPerDay) : '—'} sub="for its age" color={HUE} />
            <Metric label="Stock" value={listing ? formatNumber(listing.quantity ?? 0) : '—'} color={C.ink} />
            <Metric label="Released" value={product.createdTimestamp ? fmtDate(product.createdTimestamp) : '—'} color={C.ink} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={product.url} target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, background: HUE, height: 42, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>View on Etsy ↗</a>
            <button onClick={() => tagAnalysis.mutate()} disabled={tagAnalysis.isPending || !product.tags.length}
              style={{ height: 42, padding: '0 18px', borderRadius: 28, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: tagAnalysis.isPending ? 0.6 : 1 }}>
              {tagAnalysis.isPending ? 'Analyzing tags…' : 'Analyze all tags'}
            </button>
          </div>
        </div>
      </div>

      {/* Tags — clickable */}
      {product.tags.length > 0 && (
        <Card>
          <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>click a tag to research it</span>}>Tags</SectionTitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {product.tags.map(t => (
              <button key={t} onClick={() => researchTag(t)} title="Research this keyword"
                style={{ fontSize: 13, fontFamily: MONO, color: HUE, background: withAlpha(HUE, 0.10), border: `1px solid ${withAlpha(HUE, 0.4)}`, padding: '5px 13px', borderRadius: 100, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = HUE; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = withAlpha(HUE, 0.10); e.currentTarget.style.color = HUE }}>
                {t}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Per-tag analysis table (real) */}
      {(tagAnalysis.data || tagAnalysis.isPending) && (
        <Card pad={0}>
          <div style={{ padding: '16px 18px 12px' }}>
            <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>real Etsy + Google</span>}>Tag analysis</SectionTitle>
          </div>
          {tagAnalysis.isPending ? <div style={{ padding: '0 18px 18px' }}><Loading label="Running a live Etsy search for each tag…" /></div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.9fr 0.9fr 0.9fr 0.9fr', gap: 10, padding: '10px 18px', background: C.headerBg, borderTop: `1px solid ${C.ash}`, borderBottom: `1px solid ${C.ash}` }}>
                {['Tag', 'Competition', 'Avg views', 'Avg favs', 'Favs/view', 'Google/mo'].map((h, i) => (
                  <span key={h} style={{ fontSize: 10.5, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.graphite, textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
                ))}
              </div>
              {(tagAnalysis.data ?? []).map(r => (
                <button key={r.keyword} onClick={() => researchTag(r.keyword)}
                  style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.9fr 0.9fr 0.9fr 0.9fr', gap: 10, padding: '11px 18px', borderBottom: `1px solid ${C.hair}`, alignItems: 'center', width: '100%', background: 'transparent', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 13.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.keyword}</span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: r.competition == null ? C.stone : r.competition > 100000 ? D.hard : r.competition > 10000 ? D.mid : D.good, textAlign: 'right' }}>{r.competition != null ? formatNumber(r.competition) : '—'}</span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: C.graphite, textAlign: 'right' }}>{r.avgViews != null ? formatNumber(r.avgViews) : '—'}</span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: C.graphite, textAlign: 'right' }}>{r.avgFavorites != null ? formatNumber(r.avgFavorites) : '—'}</span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: C.graphite, textAlign: 'right' }}>{r.favPerView != null ? `${r.favPerView}%` : '—'}</span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: r.googleSearches != null ? C.ink : C.stone, textAlign: 'right' }}>{r.googleSearches != null ? formatNumber(r.googleSearches) : '—'}</span>
                </button>
              ))}
              <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6, padding: '12px 18px' }}>
                Competition = real live-listing count per tag. Views/favorites are the real averages of the listings ranking for it. Google/mo is real Google Ads volume when connected. No sales column — Etsy publishes none per listing.
              </p>
            </>
          )}
        </Card>
      )}

      {/* Shop card */}
      <Card>
        <SectionTitle right={shopQ.isLoading ? <span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>loading…</span> : undefined}>Shop</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, background: withAlpha(HUE, 0.12), color: HUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏪</span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{product.shopName || '—'}</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4, fontSize: 13, color: C.graphite }}>
              <span><strong style={{ color: D.good }}>{shopSales != null ? formatNumber(shopSales) : '—'}</strong> lifetime sales</span>
              {shopReviews > 0 && <span>★ {shopRating.toFixed(2)} ({formatNumber(shopReviews)})</span>}
              {shop?.listing_active_count != null && <span>{formatNumber(Number(shop.listing_active_count))} listings</span>}
            </div>
          </div>
          <a href={`https://www.etsy.com/shop/${encodeURIComponent(product.shopName)}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, fontFamily: MONO, color: C.ink, textDecoration: 'none', border: `1px solid ${C.ash}`, padding: '8px 14px', borderRadius: 100 }}>
            View shop ↗
          </a>
        </div>
      </Card>

      {/* AI read */}
      {aiFacts.length >= 2 && (
        <AiInsights
          tool="Hot Product"
          subject={product.title.slice(0, 60)}
          facts={aiFacts}
          notes="All figures are real Etsy measurements (no per-listing sales exist — shop sales are shop-wide lifetime). Interpret why this product is performing, what makes it 'hot' (favorite-velocity + engagement), and what a seller entering this niche should learn from it. Never invent sales or revenue."
        />
      )}

      {listingQ.isLoading && <Loading label="Loading full product details…" />}
    </div>
  )
}
