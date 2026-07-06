'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import { Card, SearchBar, StatCard, SectionTitle, ErrorBox, EmptyState, tableCard, tableHead, th, tableRow, tdMono, tdTitle } from '../kit'
import type { EtsyListing } from '@/types'

const GRID = '3fr 0.8fr 0.8fr 0.8fr'

function priceStr(l: EtsyListing) {
  if (!l.price?.amount) return '—'
  return `${l.price.currency_code} ${(l.price.amount / (l.price.divisor || 100)).toFixed(2)}`
}

export function ShopTab() {
  const [shopInput, setShopInput] = useState('')
  const [shopId,    setShopId]    = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/shop?id=${encodeURIComponent(shopId)}`)
      return data.data as { shop: Record<string, unknown>; listings: EtsyListing[] }
    },
    enabled: shopId.length > 1,
    staleTime: 1000 * 60 * 15,
    retry: false,
  })

  const totalViews = data?.listings.reduce((s, l) => s + (l.views ?? 0), 0) ?? 0
  const totalFavs  = data?.listings.reduce((s, l) => s + (l.num_favorers ?? 0), 0) ?? 0
  const avgPrice   = data?.listings.length
    ? data.listings.reduce((s, l) => s + (l.price?.amount ?? 0) / (l.price?.divisor || 100), 0) / data.listings.length
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="18px">
        <p style={{ fontSize: 13, fontWeight: 600, color: C.charcoal, marginBottom: 3 }}>Analyze any Etsy shop</p>
        <p style={{ fontSize: 12.5, color: C.inkFaint, marginBottom: 14 }}>Enter a shop name or ID to see their listings, views, and performance metrics.</p>
        <SearchBar value={shopInput} onChange={setShopInput} onSubmit={() => setShopId(shopInput.trim())}
          placeholder="e.g. SilverCraftStudio or shop ID…" button="Analyze →" maxWidth={460} />
      </Card>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[76, 160, 240].map(h => <div key={h} className="shimmer" style={{ height: h, borderRadius: 10, background: '#e8e7e2' }} />)}
        </div>
      )}

      {isError && <ErrorBox>Shop not found. Check the shop name or ID and try again.</ErrorBox>}

      {data && !isLoading && (
        <>
          {/* Shop header */}
          <div style={{ background: C.charcoal, borderRadius: 10, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏪</div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: C.snow, marginBottom: 2 }}>{String(data.shop.shop_name ?? shopId)}</h2>
              <p style={{ fontSize: 12.5, color: 'rgba(252,252,247,0.6)' }}>{data.listings.length} active listings</p>
            </div>
          </div>

          {/* Stats */}
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Active Listings" value={String(data.listings.length)} accent={C.charcoal} />
            <StatCard label="Total Views" value={formatNumber(totalViews)} accent={C.orange} />
            <StatCard label="Total Favorites" value={formatNumber(totalFavs)} accent={C.charcoal} />
            <StatCard label="Avg. Price" value={avgPrice > 0 ? `$${avgPrice.toFixed(2)}` : '—'} accent={C.charcoal} />
          </div>

          {/* Listings */}
          <div>
            <SectionTitle>Active Listings</SectionTitle>
            <div style={tableCard}>
              <div style={tableHead(GRID)}>
                {['Title', 'Price', 'Views', 'Favorites'].map(h => <span key={h} style={th}>{h}</span>)}
              </div>
              {data.listings.map(l => (
                <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ ...tableRow(GRID), textDecoration: 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={tdTitle}>{l.title}</span>
                  <span style={{ ...tdMono, color: C.charcoal, fontWeight: 600 }}>{priceStr(l)}</span>
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
