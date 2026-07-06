'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C } from '@/utils'
import { SectionTitle, ErrorBox, EmptyState, tableCard, tableHead, th, tableRow, tdMono, MONO } from '../kit'

interface TaxItem { id: number; name: string; fullPath: string; level: number }
const GRID = '1.4fr 2.4fr 0.6fr'

export function CategoryToolTab() {
  const [q, setQ] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['taxonomy'],
    queryFn: async () => (await axios.get('/api/etsy/taxonomy')).data.data as TaxItem[],
    staleTime: Infinity, gcTime: Infinity,
  })

  const filtered = useMemo(() => {
    if (!data) return []
    const t = q.trim().toLowerCase()
    const base = t ? data.filter(c => c.fullPath.toLowerCase().includes(t)) : data
    return base.slice(0, 200)
  }, [data, q])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: C.paper, borderRadius: 100, border: `1px solid ${C.hair}`, maxWidth: 520, overflow: 'hidden' }}>
        <span style={{ display: 'flex', paddingLeft: 16, color: '#a9a79f' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        </span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search Etsy categories — e.g. earrings, candle, wall art…"
          style={{ background: 'transparent', border: 'none', padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', flex: 1, color: '#1a1a1a', minWidth: 0 }} />
      </div>

      {isLoading && <div className="shimmer" style={{ height: 360, borderRadius: 8, background: '#e8e7e2' }} />}
      {isError && <ErrorBox>Couldn&apos;t load Etsy&apos;s category taxonomy. Please try again.</ErrorBox>}

      {data && !isLoading && (
        <div>
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>{filtered.length}{filtered.length === 200 ? '+' : ''} of {data.length} categories</span>}>
            {q ? `Categories matching "${q}"` : 'All Etsy categories'}
          </SectionTitle>
          {filtered.length === 0 ? (
            <EmptyState icon="🗂️" title="No categories match" sub="Try a broader term" />
          ) : (
            <div style={tableCard}>
              <div style={tableHead(GRID)}>
                {['Category', 'Full path', 'ID'].map(h => <span key={h} style={th}>{h}</span>)}
              </div>
              {filtered.map(c => (
                <div key={c.id} style={tableRow(GRID)}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: '#3a4444', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullPath}</span>
                  <button onClick={() => navigator.clipboard?.writeText(String(c.id))} title="Copy taxonomy ID" style={{ ...tdMono, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: C.orange }}>{c.id}</button>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 12, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
            Etsy&apos;s official seller taxonomy — pick the deepest category that fits your product for the best placement. (Etsy&apos;s API doesn&apos;t expose category popularity, so these aren&apos;t ranked.)
          </p>
        </div>
      )}
    </div>
  )
}
