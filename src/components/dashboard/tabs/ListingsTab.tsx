'use client'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import type { EtsyListing } from '@/types'

function priceStr(listing: EtsyListing): string {
  if (!listing.price?.amount) return '—'
  return `${listing.price.currency_code} ${(listing.price.amount / (listing.price.divisor || 100)).toFixed(2)}`
}

function ListingCard({ listing }: { listing: EtsyListing }) {
  const img = listing.images?.[0]?.url_570xN
  return (
    <a href={listing.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'block', background: C.snow, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.07)', textDecoration: 'none', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(28,58,19,0.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
      <div style={{ height: 180, background: C.warmGray, overflow: 'hidden' }}>
        {img
          ? <img src={img} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 32 }}>🛍</div>
        }
      </div>
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a1a', marginBottom: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {listing.title}
        </p>
        <p style={{ fontSize: 12, color: C.forest, fontWeight: 600, marginBottom: 8 }}>{priceStr(listing)}</p>
        <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: '#888', fontFamily: "'IBM Plex Mono',monospace" }}>
          <span>👁 {formatNumber(listing.views ?? 0)}</span>
          <span>♥ {formatNumber(listing.num_favorers ?? 0)}</span>
        </div>
        {listing.shop_name && (
          <p style={{ fontSize: 10.5, color: '#aaa', marginTop: 6 }}>by {listing.shop_name}</p>
        )}
      </div>
    </a>
  )
}

export function ListingsTab() {
  const [search, setSearch] = useState('handmade jewelry')
  const [query,  setQuery]  = useState('handmade jewelry')

  const { data: listings, isLoading, isError } = useQuery({
    queryKey: ['listings', query],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(query)}&limit=24`)
      return (data.data ?? []) as EtsyListing[]
    },
    staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const v = search.trim(); if (v.length < 2) return; setQuery(v)
  }, [search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', background: C.warmGray, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.09)', maxWidth: 480 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()}
            placeholder="Search Etsy listings..."
            style={{ background: 'transparent', border: 'none', padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', flex: 1, color: '#1a1a1a' }} />
        </div>
        <button onClick={go}
          style={{ background: C.forest, color: C.snow, border: 'none', padding: '0 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          Search →
        </button>
      </div>

      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 260, borderRadius: 12, background: '#ddd' }} />
          ))}
        </div>
      )}
      {isError && (
        <div style={{ background: '#fff0f0', borderRadius: 10, padding: '14px 16px', color: '#c00', fontSize: 13 }}>
          ⚠ Failed to load listings. Check your APIFY_API_TOKEN.
        </div>
      )}
      {listings && !isLoading && (
        <>
          <p style={{ fontSize: 12, color: '#888', fontFamily: "'IBM Plex Mono',monospace" }}>
            {listings.length} listings for &ldquo;{query}&rdquo;
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {listings.map(l => <ListingCard key={l.listing_id} listing={l} />)}
          </div>
        </>
      )}
    </div>
  )
}
