'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, D, flag, formatNumber } from '@/utils'
import { Card, SearchBar, StatCard, SectionTitle, ErrorBox, EmptyState, tableCard, tableHead, th, tableRow, tdMono, tdTitle, MONO } from '../kit'
import { BarChart } from '@/components/charts/BarChart'
import { VelocityPanel } from '../keyword/VelocityPanel'
import type { EtsyListing } from '@/types'
import type { ShopReview, ShopSection } from '@/lib/etsy'

const fmtDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''

const GRID = '3fr 0.8fr 0.8fr 0.8fr'
const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', NZD: 'NZ$', JPY: '¥' }
const symOf = (c?: string) => CUR[c ?? 'USD'] ?? ((c ?? '') + ' ')

function priceStr(l: EtsyListing) {
  if (!l.price?.amount) return '—'
  return `${symOf(l.price.currency_code)}${(l.price.amount / (l.price.divisor || 100)).toFixed(2)}`
}

function Stars({ rating, color = '#fff' }: { rating: number; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} title={`${rating.toFixed(2)} / 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? color : 'none'} stroke={color} strokeWidth="1.6" strokeLinejoin="round" style={{ opacity: i <= Math.round(rating) ? 1 : 0.4 }}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}

export function ShopTab() {
  const [shopInput, setShopInput] = useState('')
  const [shopId,    setShopId]    = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: async () => {
      const [shopRes, revRes, secRes] = await Promise.all([
        axios.get(`/api/etsy/shop?id=${encodeURIComponent(shopId)}`),
        axios.get(`/api/etsy/reviews?id=${encodeURIComponent(shopId)}&limit=8`).catch(() => ({ data: { data: [] } })),
        axios.get(`/api/etsy/sections?id=${encodeURIComponent(shopId)}`).catch(() => ({ data: { data: [] } })),
      ])
      const base = shopRes.data.data as { shop: Record<string, unknown>; listings: EtsyListing[] }
      return { ...base, reviews: (revRes.data.data ?? []) as ShopReview[], sections: (secRes.data.data ?? []) as ShopSection[] }
    },
    enabled: shopId.length > 1,
    staleTime: 1000 * 60 * 15,
    retry: false,
  })

  const shop = (data?.shop ?? {}) as Record<string, unknown>
  const reviewAvg   = Number(shop.review_average ?? 0)
  const reviewCount = Number(shop.review_count ?? 0)
  const shopFavs    = Number(shop.num_favorers ?? 0)
  const activeCount = Number(shop.listing_active_count ?? data?.listings.length ?? 0)
  const cur         = symOf((data?.listings.find(l => l.price?.currency_code)?.price.currency_code))
  const totalViews  = data?.listings.reduce((s, l) => s + (l.views ?? 0), 0) ?? 0

  // Real figures off the shop record — Etsy's transaction_sold_count is the
  // shop's actual lifetime sales, not a proxy.
  const sales      = shop.sales != null ? Number(shop.sales) : null
  const countryIso = shop.countryIso ? String(shop.countryIso) : null
  const yearOpened = shop.yearOpened != null ? Number(shop.yearOpened) : null
  const onVacation = Boolean(shop.is_vacation)
  const age        = yearOpened ? new Date().getFullYear() - yearOpened : null
  // Sales per active listing — how hard each listing works. Useful, and only
  // computable now that real sales are available.
  const salesPerListing = sales != null && activeCount > 0 ? sales / activeCount : null

  // Prices within one shop share a currency, so a mean is safe here (unlike a
  // cross-shop search, which mixes currencies with no FX rate).
  const avgPrice    = data?.listings.length
    ? data.listings.reduce((s, l) => s + (l.price?.amount ?? 0) / (l.price?.divisor || 100), 0) / data.listings.length
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="20px">
        <p style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Analyze any Etsy shop</p>
        <p style={{ fontSize: 14, color: C.graphite, marginBottom: 16 }}>Enter a shop name or ID to see their listings, ratings, views, and performance metrics.</p>
        <SearchBar value={shopInput} onChange={setShopInput} onSubmit={() => setShopId(shopInput.trim())}
          placeholder="e.g. SilverCraftStudio or shop ID…" button="Analyze →" maxWidth={460} />
      </Card>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[88, 160, 240].map(h => <div key={h} className="shimmer" style={{ height: h, borderRadius: 14, background: '#e8e7e2' }} />)}
        </div>
      )}

      {isError && <ErrorBox>Shop not found. Check the shop name or ID and try again.</ErrorBox>}

      {data && !isLoading && (
        <>
          {/* Shop header */}
          <div style={{ background: C.charcoal, borderRadius: 16, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏪</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 21, fontWeight: 500, color: C.snow, marginBottom: 5, letterSpacing: '-0.02em' }}>{String(shop.shop_name ?? shopId)}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                {reviewCount > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Stars rating={reviewAvg} color={C.orange} />
                    <span style={{ fontSize: 14, color: '#F5F5EB', fontWeight: 500 }}>{reviewAvg.toFixed(1)}</span>
                    <span style={{ fontSize: 13, color: 'rgba(245,245,235,0.6)' }}>({formatNumber(reviewCount)} reviews)</span>
                  </span>
                )}
                <span style={{ fontSize: 13.5, color: 'rgba(245,245,235,0.6)' }}>{formatNumber(activeCount)} active listings · {formatNumber(shopFavs)} admirers</span>
                {countryIso && <span style={{ fontSize: 13.5, color: 'rgba(245,245,235,0.75)' }}>{flag(countryIso)} {countryIso}</span>}
                {yearOpened && (
                  <span style={{ fontSize: 13.5, color: 'rgba(245,245,235,0.6)' }}>
                    since {yearOpened}{age ? ` · ${age} yr${age === 1 ? '' : 's'}` : ''}
                  </span>
                )}
                {onVacation && (
                  <span style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', background: D.midBg, color: D.mid, padding: '3px 10px', borderRadius: 100 }}>On vacation</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats — sales leads, because it's the only figure that measures the
              business rather than the storefront. */}
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Lifetime Sales" value={sales != null ? formatNumber(sales) : '—'} accent={D.good}
              sub={sales != null ? 'real · transaction_sold_count' : 'not published for this shop'} />
            <StatCard label="Shop Rating" value={reviewCount > 0 ? `${reviewAvg.toFixed(2)}★` : '—'}
              accent={reviewAvg >= 4.8 ? D.good : reviewAvg >= 4.5 ? D.mid : reviewCount > 0 ? D.hard : C.stone}
              sub={reviewCount > 0 ? `${formatNumber(reviewCount)} reviews` : 'no reviews yet'} />
            <StatCard label="Active Listings" value={formatNumber(activeCount)} accent="#2E6DB4"
              sub={salesPerListing != null ? `${salesPerListing.toFixed(0)} sales per listing` : undefined} />
            <StatCard label="Shop Admirers" value={formatNumber(shopFavs)} accent={C.ink}
              sub={avgPrice > 0 ? `avg price ${cur}${avgPrice.toFixed(2)}` : `${formatNumber(totalViews)} views sampled`} />
          </div>

          {/* Sales velocity — only real if we have history. See lib/snapshots.ts. */}
          <VelocityPanel shopId={Number(shop.shop_id ?? 0)} shopName={String(shop.shop_name ?? '')} />

          {/* Sections + reviews */}
          {(data.sections?.length > 0 || data.reviews?.length > 0) && (
            <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
              {data.sections?.length > 0 && (
                <Card>
                  <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{data.sections.length} sections</span>}>Shop Sections</SectionTitle>
                  <BarChart axis="y" height={Math.min(340, 40 + data.sections.length * 30)} highlightMax
                    labels={data.sections.slice(0, 10).map(s => s.title)}
                    values={data.sections.slice(0, 10).map(s => s.active_listing_count)} />
                </Card>
              )}
              {data.reviews?.length > 0 && (
                <Card>
                  <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>latest {data.reviews.length}</span>}>Recent Reviews</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {data.reviews.map((r, i) => (
                      <div key={i} style={{ paddingBottom: 14, borderBottom: i < data.reviews.length - 1 ? `1px solid ${C.hair}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Stars rating={r.rating} color={C.orange} />
                          <span style={{ fontSize: 12.5, color: C.stone, fontFamily: MONO }}>{fmtDate(r.created_timestamp)}</span>
                        </div>
                        {r.review
                          ? <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.5 }}>{r.review.length > 220 ? r.review.slice(0, 220) + '…' : r.review}</p>
                          : <p style={{ fontSize: 13.5, color: C.graphite, fontStyle: 'italic' }}>★ {r.rating}/5 — no written review</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Listings */}
          <div>
            <SectionTitle>Active Listings</SectionTitle>
            <div className="rtable" style={tableCard}>
              <div style={tableHead(GRID)}>
                {['Title', 'Price', 'Views', 'Favorites'].map(h => <span key={h} style={th}>{h}</span>)}
              </div>
              {data.listings.map(l => (
                <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ ...tableRow(GRID), textDecoration: 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={tdTitle}>{l.title}</span>
                  <span style={{ ...tdMono, color: C.charcoal, fontWeight: 500 }}>{priceStr(l)}</span>
                  <span style={tdMono}>{formatNumber(l.views ?? 0)}</span>
                  <span style={tdMono}>{formatNumber(l.num_favorers ?? 0)}</span>
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {!shopId && !isLoading && (
        <EmptyState icon="🏪" title="Enter any Etsy shop name above" sub="See their listings, views, favorites, and pricing" />
      )}
    </div>
  )
}
