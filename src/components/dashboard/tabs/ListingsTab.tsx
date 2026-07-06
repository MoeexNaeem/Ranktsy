'use client'
import { useState, useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import { SearchBar, ErrorBox, Pagination, cardStyle, MONO } from '../kit'
import type { EtsyListing } from '@/types'

const PAGE_SIZE = 24

function priceStr(listing: EtsyListing): string {
  if (!listing.price?.amount) return '—'
  return `${listing.price.currency_code} ${(listing.price.amount / (listing.price.divisor || 100)).toFixed(2)}`
}

function ListingCard({ listing }: { listing: EtsyListing }) {
  const img = listing.images?.[0]?.url_570xN
  return (
    <a href={listing.url} target="_blank" rel="noopener noreferrer"
      style={{ ...cardStyle, display: 'block', overflow: 'hidden', textDecoration: 'none', transition: 'transform 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none' }}>
      <div style={{ height: 172, background: C.canvas, overflow: 'hidden' }}>
        {img
          ? <img src={img} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8c8c0', fontSize: 30 }}>🛍</div>
        }
      </div>
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a1a', marginBottom: 5, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, minHeight: 35 }}>
          {listing.title}
        </p>
        <p style={{ fontSize: 13, color: C.orange, fontWeight: 700, marginBottom: 8, fontFamily: MONO }}>{priceStr(listing)}</p>
        <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: '#808080', fontFamily: MONO }}>
          <span>👁 {formatNumber(listing.views ?? 0)}</span>
          <span>♥ {formatNumber(listing.num_favorers ?? 0)}</span>
        </div>
        {listing.shop_name && (
          <p style={{ fontSize: 10.5, color: '#b0b0a8', marginTop: 6 }}>by {listing.shop_name}</p>
        )}
      </div>
    </a>
  )
}

export function ListingsTab() {
  const [search, setSearch] = useState('handmade jewelry')
  const [query,  setQuery]  = useState('handmade jewelry')
  const [page,   setPage]   = useState(1)

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['listings', query, page],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`)
      return data as { data: EtsyListing[]; count: number }
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const v = search.trim(); if (v.length < 2) return; setPage(1); setQuery(v)
  }, [search])

  const listings  = data?.data ?? []
  const total     = data?.count ?? 0
  const pageCount = Math.min(Math.ceil(total / PAGE_SIZE) || 1, 500)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={search} onChange={setSearch} onSubmit={go} placeholder="Search Etsy listings…" />

      {isLoading && (
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 268, borderRadius: 8, background: '#e8e7e2' }} />
          ))}
        </div>
      )}
      {isError && <ErrorBox>Failed to load listings from Etsy. Please try again.</ErrorBox>}
      {!isLoading && !isError && (
        <>
          <p style={{ fontSize: 12, color: '#808080', fontFamily: MONO }}>
            {formatNumber(total)} results for &ldquo;{query}&rdquo; · page {page} of {formatNumber(pageCount)}
          </p>
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, opacity: isFetching ? 0.55 : 1, transition: 'opacity 0.15s' }}>
            {listings.map(l => <ListingCard key={l.listing_id} listing={l} />)}
          </div>
          <Pagination page={page} pageCount={pageCount} loading={isFetching}
            onChange={p => setPage(p)} />
        </>
      )}
    </div>
  )
}
