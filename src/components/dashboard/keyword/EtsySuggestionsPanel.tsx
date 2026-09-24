'use client'
/**
 * Phrases ETSY ITSELF suggests for a keyword.
 *
 * Etsy prints a related-search row on every results page and offers autocomplete
 * as a shopper types. Both are Etsy naming the words its own buyers use, and
 * neither is returned by any Etsy API. Google's keyword ideas answer a different
 * question (what people type into Google), so these are the only Etsy-native
 * expansions available anywhere, gathered as sellers browse with the extension.
 */
import { memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, SectionTitle, MONO, EmptyState } from '../kit'
import { Shimmer } from '../skeletons'
import { C } from '@/utils'
import type { ApiResponse } from '@/types'

interface Suggestion {
  suggestion: string
  source: 'related' | 'autocomplete'
  position: number
  seenCount: number
  lastSeenAt: string
}

export const EtsySuggestionsPanel = memo(function EtsySuggestionsPanel({
  query, onSelect,
}: { query: string; onSelect?: (kw: string) => void }) {
  const q = useQuery({
    queryKey: ['etsy-suggestions', query.toLowerCase().trim()],
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/etsy/keyword-suggestions?q=${encodeURIComponent(query)}`, { signal })
      const j = (await r.json()) as ApiResponse<{ suggestions: Suggestion[] }>
      if (!j.success || !j.data) throw new Error(j.error ?? 'Failed')
      return j.data.suggestions
    },
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    // Our own store, never an upstream call: a miss is a real answer.
    retry: false,
  })

  if (q.isPending) return <Card><SectionTitle>Etsy&rsquo;s Own Suggestions</SectionTitle><Shimmer h={150} r={8} /></Card>

  const rows = q.data ?? []
  if (!rows.length) {
    return (
      <Card>
        <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>Etsy</span>}>Etsy&rsquo;s Own Suggestions</SectionTitle>
        <EmptyState
          icon="🔤"
          title="Nothing captured yet"
          sub="These are the phrases Etsy shows on its own results pages. They are collected as sellers browse Etsy with the Rankkw extension, so this fills in once someone searches this term."
        />
      </Card>
    )
  }

  // Seen often = Etsy shows it consistently, which is the strongest signal here.
  const strongest = Math.max(...rows.map(r => r.seenCount), 1)

  return (
    <Card>
      <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.graphite }}>{rows.length} phrases</span>}>
        Etsy&rsquo;s Own Suggestions
      </SectionTitle>
      <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 12, lineHeight: 1.55 }}>
        What <strong style={{ color: C.ink }}>Etsy itself</strong> suggests to shoppers searching this term. No Etsy API
        returns these, so they come from real results pages. A phrase Etsy shows repeatedly is a stronger signal than one seen once.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rows.map(r => {
          const strong = r.seenCount >= Math.max(2, strongest * 0.6)
          return (
            <button
              key={`${r.source}:${r.suggestion}`}
              onClick={() => onSelect?.(r.suggestion)}
              title={`Seen ${r.seenCount}x · Etsy listed it at position ${r.position} · ${r.source === 'related' ? 'related search row' : 'search autocomplete'}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 13, fontFamily: 'inherit', fontWeight: strong ? 600 : 500,
                color: C.ink, background: strong ? C.orangeFaint : C.paper,
                border: `1px solid ${strong ? 'rgba(251,94,9,0.4)' : C.ash}`,
                borderRadius: 100, padding: '7px 14px',
                cursor: onSelect ? 'pointer' : 'default',
              }}>
              {r.suggestion}
              <span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>{r.seenCount}&times;</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
})
