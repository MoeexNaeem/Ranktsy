'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import type { EtsyListing } from '@/types'

function priceStr(l: EtsyListing) {
  if (!l.price?.amount) return '—'
  return `${l.price.currency_code} ${(l.price.amount / (l.price.divisor || 100)).toFixed(2)}`
}

export function ShopTab() {
  const [shopInput, setShopInput] = useState('')
  const [shopId,    setShopId]    = useState('')

  const { data, isLoading, isError, error } = useQuery({
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Shop lookup */}
      <div style={{ background: C.warmGray, borderRadius: 12, padding: '18px' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.forest, marginBottom: 4 }}>Analyze any Etsy shop</p>
        <p style={{ fontSize: 12.5, color: '#888', marginBottom: 14 }}>Enter a shop name or ID to see their listings, views, and performance metrics.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={shopInput} onChange={e => setShopInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setShopId(shopInput.trim())}
            placeholder="e.g. SilverCraftStudio or shop ID..."
            style={{ flex: 1, background: C.snow, border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', maxWidth: 420 }} />
          <button onClick={() => setShopId(shopInput.trim())}
            style={{ background: C.forest, color: C.snow, border: 'none', padding: '0 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Analyze →
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[76, 160, 240].map(h => <div key={h} className="shimmer" style={{ height: h, borderRadius: 12, background: '#ddd' }} />)}
        </div>
      )}

      {isError && (
        <div style={{ background: '#fff0f0', borderRadius: 10, padding: '14px 16px', color: '#c00', fontSize: 13 }}>
          ⚠ Shop not found or scraper error. Check the shop name and your APIFY_API_TOKEN.
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Shop header */}
          <div style={{ background: C.forest, borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.pale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏪</div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 500, color: C.snow, marginBottom: 2 }}>
                {String(data.shop.shop_name ?? shopId)}
              </h2>
              <p style={{ fontSize: 12.5, color: 'rgba(252,252,247,0.6)' }}>
                {String(data.shop.listing_active_count ?? data.listings.length)} active listings
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9 }}>
            {[
              { label: 'Active Listings', value: String(data.listings.length),       color: C.forest },
              { label: 'Total Views',     value: formatNumber(totalViews),            color: C.mutedYellow },
              { label: 'Total Favorites', value: formatNumber(totalFavs),             color: C.mutedTeal },
              { label: 'Avg. Price',      value: avgPrice > 0 ? `$${avgPrice.toFixed(2)}` : '—', color: C.forest },
            ].map(s => (
              <div key={s.label} style={{ background: C.warmGray, borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono',monospace", color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Listings */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.forest, marginBottom: 8 }}>Active Listings</p>
            <div style={{ background: C.snow, border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 0.8fr 0.8fr', gap: 8, padding: '8px 14px', background: '#f8f8f4', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Title', 'Price', 'Views', 'Favorites'].map(h => (
                  <span key={h} style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aaa' }}>{h}</span>
                ))}
              </div>
              {data.listings.map(l => (
                <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 0.8fr 0.8fr', gap: 8, padding: '9px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center', textDecoration: 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(238,238,233,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                  <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: C.forest, fontWeight: 600 }}>{priceStr(l)}</span>
                  <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: '#555' }}>{formatNumber(l.views ?? 0)}</span>
                  <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: '#555' }}>{formatNumber(l.num_favorers ?? 0)}</span>
                </a>
              ))}
            </div>
          </div>
        </>
      )}

      {!shopId && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏪</div>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.forest }}>Enter any Etsy shop name above</p>
          <p style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>See their listings, views, favorites, and pricing</p>
        </div>
      )}
    </div>
  )
}
