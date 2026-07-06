'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import { SearchBar, SectionTitle, ErrorBox, EmptyState, Card, tableCard, tableHead, th, tableRow, tdMono, MONO } from '../kit'
import type { EtsyListing } from '@/types'

const GRID = '2.4fr 0.7fr 1fr 1fr'

export function CompetitorTagsTab() {
  const [input, setInput] = useState('')
  const [shop, setShop] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['competitor-tags', shop],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/shop?id=${encodeURIComponent(shop)}`)
      return data.data as { shop: Record<string, unknown>; listings: EtsyListing[] }
    },
    enabled: shop.length > 1, staleTime: 1000 * 60 * 15, retry: false,
  })

  const go = useCallback(() => { const v = input.trim(); if (v.length < 2) return; setShop(v) }, [input])

  const tags = useMemo(() => {
    if (!data?.listings?.length) return []
    const counts: Record<string, { c: number; v: number; f: number }> = {}
    data.listings.forEach(l => (l.tags ?? []).forEach(t => {
      const k = t.toLowerCase().trim(); if (!k) return
      if (!counts[k]) counts[k] = { c: 0, v: 0, f: 0 }
      counts[k].c++; counts[k].v += l.views ?? 0; counts[k].f += l.num_favorers ?? 0
    }))
    return Object.entries(counts)
      .sort((a, b) => b[1].c - a[1].c || b[1].v - a[1].v)
      .map(([tag, d]) => ({ tag, count: d.c, avgViews: Math.round(d.v / d.c), avgFavs: Math.round(d.f / d.c) }))
  }, [data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={go} placeholder="Competitor shop name or ID…" button="Extract tags →" maxWidth={460} />

      {isLoading && <div className="shimmer" style={{ height: 360, borderRadius: 8, background: '#e8e7e2' }} />}
      {isError && <ErrorBox>Shop not found. Check the name or ID and try again.</ErrorBox>}

      {tags.length > 0 && !isLoading && (
        <>
          <Card pad="14px 16px">
            <p style={{ fontSize: 13, color: C.ink }}>
              <strong>{String(data?.shop.shop_name ?? shop)}</strong> uses <strong>{tags.length}</strong> unique tags across {data?.listings.length} listings.
            </p>
          </Card>
          <div>
            <SectionTitle right={<button onClick={() => navigator.clipboard?.writeText(tags.slice(0, 13).map(t => t.tag).join(', '))} style={{ fontSize: 12, fontFamily: MONO, color: C.orange, background: 'transparent', border: `1px solid ${C.orange}`, padding: '4px 12px', borderRadius: 100, cursor: 'pointer' }}>Copy top 13</button>}>
              Tags ranked by usage
            </SectionTitle>
            <div style={tableCard}>
              <div style={tableHead(GRID)}>
                {['Tag', 'Used', 'Avg Views', 'Avg Favs'].map(h => <span key={h} style={th}>{h}</span>)}
              </div>
              {tags.map(t => (
                <div key={t.tag} style={tableRow(GRID)}>
                  <button onClick={() => navigator.clipboard?.writeText(t.tag)} title="Click to copy"
                    style={{ fontSize: 12.5, fontFamily: MONO, color: C.ink, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.tag}</button>
                  <span style={tdMono}>{t.count}×</span>
                  <span style={tdMono}>{formatNumber(t.avgViews)}</span>
                  <span style={tdMono}>{formatNumber(t.avgFavs)}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
              Tags are pulled from the shop&apos;s active listings via the official Etsy API. Click any tag to copy it.
            </p>
          </div>
        </>
      )}

      {!shop && !isLoading && <EmptyState icon="🔖" title="See any shop's tags" sub="Enter a competitor's shop to extract and rank the tags they use" />}
    </div>
  )
}
