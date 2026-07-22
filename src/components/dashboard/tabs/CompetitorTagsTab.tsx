'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import { SearchBar, SectionTitle, ErrorBox, EmptyState, Card, tableCard, tableHead, th, tableRow, tdMono, MONO } from '../kit'
import { AiInsights } from '../AiInsights'
import type { EtsyListing, AiFact } from '@/types'

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

  // Real facts for the AI tag-strategy read — every figure measured from the
  // shop's active listings. Gemini interprets the strategy; it invents nothing.
  const aiFacts = useMemo<AiFact[]>(() => {
    if (!tags.length || !data) return []
    const f: AiFact[] = [
      { label: 'Unique tags used', value: String(tags.length), hint: `across ${data.listings.length} listings` },
    ]
    tags.slice(0, 6).forEach((t, i) => f.push({
      label: `Top tag ${i + 1}`,
      value: t.tag,
      hint: `used ${t.count}×, ${formatNumber(t.avgViews)} avg views, ${formatNumber(t.avgFavs)} avg favorites`,
    }))
    return f
  }, [tags, data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={go} placeholder="Shop name or ID…" button="Analyze →" maxWidth={460} />

      {isLoading && <div className="shimmer" style={{ height: 360, borderRadius: 8, background: '#e8e7e2' }} />}
      {isError && <ErrorBox>Shop not found. Check the name or ID and try again.</ErrorBox>}

      {tags.length > 0 && !isLoading && (
        <>
          <Card pad="16px 18px">
            <p style={{ fontSize: 14.5, color: C.ink }}>
              <strong>{String(data?.shop.shop_name ?? shop)}</strong> uses <strong>{tags.length}</strong> unique tags across {data?.listings.length} listings.
            </p>
          </Card>
          <div>
            <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{tags.length} tags · ranked by usage</span>}>
              Tag performance
            </SectionTitle>
            <div className="rtable" style={tableCard}>
              <div style={tableHead(GRID)}>
                {['Tag', 'Used', 'Avg Views', 'Avg Favs'].map(h => <span key={h} style={th}>{h}</span>)}
              </div>
              {tags.map(t => (
                <div key={t.tag} style={tableRow(GRID)}>
                  <span style={{ fontSize: 14.5, fontFamily: MONO, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.tag}</span>
                  <span style={tdMono}>{t.count}×</span>
                  <span style={tdMono}>{formatNumber(t.avgViews)}</span>
                  <span style={tdMono}>{formatNumber(t.avgFavs)}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: C.graphite, marginTop: 12, lineHeight: 1.55 }}>
              For market research — see which tags a shop uses across its active listings and how those tags correlate with views &amp; favorites. Tags come from the official Etsy API. Always write your own tags that genuinely describe your product.
            </p>
          </div>

          {/* AI read of the shop's tag strategy. */}
          {aiFacts.length >= 2 && (
            <AiInsights
              tool="Competitor Tags"
              subject={String(data?.shop.shop_name ?? shop)}
              facts={aiFacts}
              notes="Tags are from the shop's active listings; avg views/favorites are the real averages of the listings carrying each tag. Interpret this shop's tag strategy — which tags correlate with the strongest engagement, how broad vs focused the strategy is, and what a competitor could learn. Advise writing original tags that describe one's own product."
            />
          )}
        </>
      )}

      {!shop && !isLoading && <EmptyState icon="🔖" title="Analyze a shop's tags" sub="See which tags a shop uses across its listings and how they perform — for niche research" />}
    </div>
  )
}
