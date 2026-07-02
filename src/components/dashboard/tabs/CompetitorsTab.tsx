'use client'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import type { EtsyListing } from '@/types'

function priceStr(l: EtsyListing) {
  if (!l.price?.amount) return '—'
  return `${l.price.currency_code} ${(l.price.amount / (l.price.divisor || 100)).toFixed(2)}`
}

export function CompetitorsTab() {
  const [search, setSearch] = useState('silver necklace')
  const [query,  setQuery]  = useState('silver necklace')

  const { data: listings, isLoading, isError } = useQuery({
    queryKey: ['competitors', query],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(query)}&limit=25`)
      return (data.data ?? []) as EtsyListing[]
    },
    staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const v = search.trim(); if (v.length < 2) return; setQuery(v)
  }, [search])

  // Sort by views to show top competitors first
  const sorted = listings ? [...listings].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', background: C.warmGray, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.09)', maxWidth: 480 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()}
            placeholder="Analyze competition for any keyword..."
            style={{ background: 'transparent', border: 'none', padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', outline: 'none', flex: 1, color: '#1a1a1a' }} />
        </div>
        <button onClick={go}
          style={{ background: C.charcoal, color: C.snow, border: 'none', padding: '0 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          Analyze →
        </button>
      </div>

      {isLoading && <div className="shimmer" style={{ height: 400, borderRadius: 12, background: '#ddd' }} />}
      {isError && <div style={{ background: '#fff0f0', borderRadius: 10, padding: '14px 16px', color: '#c00', fontSize: 13 }}>⚠ Failed to load. Check your APIFY_API_TOKEN.</div>}

      {sorted.length > 0 && !isLoading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
            {[
              { label: 'Total Competitors', value: sorted.length.toString(), color: C.charcoal },
              { label: 'Avg. Views',        value: formatNumber(Math.round(sorted.reduce((s,l)=>s+(l.views??0),0)/sorted.length)), color: C.orangeLight },
              { label: 'Avg. Favorites',    value: formatNumber(Math.round(sorted.reduce((s,l)=>s+(l.num_favorers??0),0)/sorted.length)), color: C.charcoal },
            ].map(s => (
              <div key={s.label} style={{ background: C.warmGray, borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono',monospace", color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 600, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: C.snow, border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 0.8fr 0.8fr 1.5fr', gap: 8, padding: '8px 14px', background: '#f8f8f4', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              {['Title', 'Price', 'Views', 'Favorites', 'Tags'].map(h => (
                <span key={h} style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aaa' }}>{h}</span>
              ))}
            </div>
            {sorted.map((l, idx) => (
              <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 0.8fr 0.8fr 1.5fr', gap: 8, padding: '9px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center', textDecoration: 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(238,238,233,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: '#bbb', width: 20 }}>#{idx + 1}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                </div>
                <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: C.charcoal, fontWeight: 600 }}>{priceStr(l)}</span>
                <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: '#555' }}>{formatNumber(l.views ?? 0)}</span>
                <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: '#555' }}>{formatNumber(l.num_favorers ?? 0)}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(l.tags ?? []).slice(0, 3).map(tag => (
                    <span key={tag} style={{ fontSize: 9.5, background: C.orange + '60', color: C.charcoal, padding: '2px 6px', borderRadius: 999, fontFamily: "'IBM Plex Mono',monospace" }}>{tag}</span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
