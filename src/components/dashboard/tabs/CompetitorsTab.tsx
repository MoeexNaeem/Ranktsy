'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import { SearchBar, StatCard, SectionTitle, ErrorBox, Pagination, tableCard, tableHead, th, tableRow, tdMono, tdTitle, TagPill, MONO } from '../kit'
import type { EtsyListing } from '@/types'

const GRID = '3fr 0.8fr 0.8fr 0.8fr 1.5fr'
const FETCH = 48        // fetched once from Etsy
const PER_PAGE = 12     // paginated client-side

function priceStr(l: EtsyListing) {
  if (!l.price?.amount) return '—'
  return `${l.price.currency_code} ${(l.price.amount / (l.price.divisor || 100)).toFixed(2)}`
}

export function CompetitorsTab() {
  const [search, setSearch] = useState('silver necklace')
  const [query,  setQuery]  = useState('silver necklace')
  const [page,   setPage]   = useState(1)

  const { data: listings, isLoading, isError } = useQuery({
    queryKey: ['competitors', query],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/search?q=${encodeURIComponent(query)}&limit=${FETCH}`)
      return (data.data ?? []) as EtsyListing[]
    },
    staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const v = search.trim(); if (v.length < 2) return; setPage(1); setQuery(v)
  }, [search])

  const sorted = useMemo(
    () => (listings ? [...listings].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)) : []),
    [listings]
  )
  const pageCount = Math.ceil(sorted.length / PER_PAGE) || 1
  const pageRows = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={search} onChange={setSearch} onSubmit={go} placeholder="Analyze competition for any keyword…" button="Analyze →" />

      {isLoading && <div className="shimmer" style={{ height: 400, borderRadius: 8, background: '#e8e7e2' }} />}
      {isError && <ErrorBox>Failed to load competitor data from Etsy. Please try again.</ErrorBox>}

      {sorted.length > 0 && !isLoading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <StatCard label="Total Competitors" value={sorted.length.toString()} accent={C.ink} />
            <StatCard label="Avg. Views" value={formatNumber(Math.round(sorted.reduce((s, l) => s + (l.views ?? 0), 0) / sorted.length))} accent={C.orange} />
            <StatCard label="Avg. Favorites" value={formatNumber(Math.round(sorted.reduce((s, l) => s + (l.num_favorers ?? 0), 0) / sorted.length))} accent={C.ink} />
          </div>

          <div>
            <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>Top {sorted.length} by views · page {page}/{pageCount}</span>}>
              Top listings for &ldquo;{query}&rdquo;
            </SectionTitle>
            <div style={tableCard}>
              <div style={tableHead(GRID)}>
                {['Title', 'Price', 'Views', 'Favorites', 'Tags'].map(h => <span key={h} style={th}>{h}</span>)}
              </div>
              {pageRows.map((l, idx) => (
                <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ ...tableRow(GRID), textDecoration: 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontFamily: MONO, color: '#bdbdb5', width: 22, flexShrink: 0 }}>#{(page - 1) * PER_PAGE + idx + 1}</span>
                    <span style={tdTitle}>{l.title}</span>
                  </div>
                  <span style={{ ...tdMono, color: C.ink, fontWeight: 600 }}>{priceStr(l)}</span>
                  <span style={tdMono}>{formatNumber(l.views ?? 0)}</span>
                  <span style={tdMono}>{formatNumber(l.num_favorers ?? 0)}</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(l.tags ?? []).slice(0, 3).map(tag => <TagPill key={tag}>{tag}</TagPill>)}
                  </div>
                </a>
              ))}
            </div>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
