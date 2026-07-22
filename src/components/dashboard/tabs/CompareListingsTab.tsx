'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import { Card, SectionTitle, ErrorBox, Loading, EmptyState, primaryBtn, MONO } from '../kit'
import { AiInsights } from '../AiInsights'
import type { EtsyListing, AiFact } from '@/types'

const extractId = (s: string) => { const m = s.match(/listing\/(\d+)/) || s.match(/(\d{6,})/); return m ? parseInt(m[1], 10) : null }
const priceOf = (l: EtsyListing) => l.price?.amount ? l.price.amount / (l.price.divisor || 100) : 0
const inputStyle: React.CSSProperties = { width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 100, padding: '10px 16px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', boxSizing: 'border-box' }

function metrics(l: EtsyListing) {
  const views = l.views ?? 0, favs = l.num_favorers ?? 0
  return {
    Views: views, Favorites: favs,
    'Engagement %': parseFloat((favs / Math.max(views, 1) * 100).toFixed(1)),
    Tags: (l.tags ?? []).length, 'Title length': l.title.length,
    'Description': (l.description ?? '').length, Photos: l.images?.length ?? 0,
    Price: priceOf(l),
  }
}
// higher is better for these; Price/Title excluded from win-highlighting
const HIGHER = new Set(['Views', 'Favorites', 'Engagement %', 'Tags', 'Description', 'Photos'])

export function CompareListingsTab() {
  const [aIn, setAIn] = useState(''); const [bIn, setBIn] = useState('')
  const [ids, setIds] = useState<{ a: number; b: number } | null>(null)
  const [err, setErr] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['compare', ids],
    queryFn: async () => {
      const [ra, rb] = await Promise.all([axios.get(`/api/etsy/listing?id=${ids!.a}`), axios.get(`/api/etsy/listing?id=${ids!.b}`)])
      return { a: ra.data.data as EtsyListing, b: rb.data.data as EtsyListing }
    },
    enabled: !!ids, retry: false, staleTime: 1000 * 60 * 30,
  })

  const go = useCallback(() => {
    const a = extractId(aIn.trim()), b = extractId(bIn.trim())
    if (!a || !b) { setErr('Paste two Etsy listing URLs or IDs.'); return }
    setErr(''); setIds({ a, b })
  }, [aIn, bIn])

  const rows = useMemo(() => {
    if (!data) return []
    const ma = metrics(data.a), mb = metrics(data.b)
    return (Object.keys(ma) as (keyof typeof ma)[]).map(k => {
      const va = ma[k], vb = mb[k]
      const winner = HIGHER.has(k as string) ? (va > vb ? 'a' : vb > va ? 'b' : '') : ''
      const fmt = (v: number) => k === 'Price' ? `$${v.toFixed(2)}` : k === 'Engagement %' ? `${v}%` : formatNumber(v)
      return { label: k as string, a: fmt(va), b: fmt(vb), winner }
    })
  }, [data])

  // One rich fact per listing — Gemini calls the winner and prescribes fixes.
  const aiFacts = useMemo<AiFact[]>(() => {
    if (!data) return []
    const describe = (l: EtsyListing) => {
      const m = metrics(l)
      const cur = l.price?.currency_code ?? 'USD'
      return `${formatNumber(m.Views)} views, ${formatNumber(m.Favorites)} favs, ${m['Engagement %']}% engagement, ${m.Tags}/13 tags, ${m['Title length']}-char title, ${m.Description}-char description, ${m.Photos} photos, ${cur} ${m.Price.toFixed(2)}`
    }
    return [
      { label: 'Listing A', value: data.a.title.slice(0, 50), hint: describe(data.a) },
      { label: 'Listing B', value: data.b.title.slice(0, 50), hint: describe(data.b) },
    ]
  }, [data])

  const Head = ({ l }: { l: EtsyListing }) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {l.images?.[0]?.url_570xN && <img src={l.images[0].url_570xN} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${C.hair}` }} />}
      <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: C.ink, textDecoration: 'none', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{l.title}</a>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="18px">
        <SectionTitle>Compare two of your listings</SectionTitle>
        <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <input value={aIn} onChange={e => setAIn(e.target.value)} placeholder="Listing A — URL or ID" style={inputStyle} />
          <input value={bIn} onChange={e => setBIn(e.target.value)} placeholder="Listing B — URL or ID" style={inputStyle} />
        </div>
        <button onClick={go} style={primaryBtn}>Compare →</button>
      </Card>

      {err && <ErrorBox>{err}</ErrorBox>}
      {isLoading && <Loading label="Fetching both listings…" />}
      {isError && <ErrorBox>One of the listings couldn&apos;t be loaded. Check the URLs/IDs.</ErrorBox>}

      {data && !isLoading && (
        <div className="rtable" style={{ ...Card, background: C.paper, border: `1px solid ${C.hairInk}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 12, padding: '16px', background: C.bone, borderBottom: `1px solid ${C.hairInk}` }}>
            <span style={{ fontSize: 10, fontFamily: MONO, color: '#808080', textTransform: 'uppercase', alignSelf: 'center' }}>Metric</span>
            <Head l={data.a} /><Head l={data.b} />
          </div>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 12, padding: '11px 16px', borderBottom: i < rows.length - 1 ? `1px solid ${C.hair}` : 'none', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: '#6E6E64' }}>{r.label}</span>
              <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: r.winner === 'a' ? 500 : 400, color: r.winner === 'a' ? C.success : C.ink }}>{r.a}{r.winner === 'a' && ' ▲'}</span>
              <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: r.winner === 'b' ? 500 : 400, color: r.winner === 'b' ? C.success : C.ink }}>{r.b}{r.winner === 'b' && ' ▲'}</span>
            </div>
          ))}
        </div>
      )}

      {data && !isLoading && aiFacts.length >= 2 && (
        <AiInsights
          tool="Compare Listings"
          subject="Listing A vs Listing B"
          facts={aiFacts}
          notes="Two real Etsy listings compared. Views/favorites are lifetime; engagement is favorites ÷ views. More tags (up to 13), photos, description length and a fuller title generally help SEO/conversion. Call which listing is stronger overall and why, then give specific fixes for the weaker one."
        />
      )}

      {!ids && !isLoading && <EmptyState icon="⚖️" title="Compare two listings" sub="Paste two listing URLs to see which performs better and why" />}
    </div>
  )
}
