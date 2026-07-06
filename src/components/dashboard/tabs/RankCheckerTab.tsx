'use client'
import { useState, useCallback } from 'react'
import axios from 'axios'
import { C, formatNumber } from '@/utils'
import { Card, SectionTitle, ErrorBox, Loading, EmptyState, tableCard, tableHead, th, tableRow, tdMono, tdTitle, primaryBtn, MONO } from '../kit'

const GRID = '1.6fr 0.9fr 2fr 0.9fr'
const MAX = 10
const enc = encodeURIComponent

interface RankRow { keyword: string; best: number | null; listing: string; url: string; onPage: number; total: number; error?: boolean }

function rankTone(pos: number | null): { color: string; bg: string; label: string } {
  if (pos == null) return { color: '#808080', bg: C.bone, label: 'Not in top 100' }
  if (pos <= 10) return { color: C.success, bg: C.successBg, label: `#${pos}` }
  if (pos <= 48) return { color: C.warn, bg: C.warnBg, label: `#${pos}` }
  return { color: C.ink, bg: C.bone, label: `#${pos}` }
}

export function RankCheckerTab() {
  const [shop, setShop] = useState('')
  const [kwText, setKwText] = useState('')
  const [rows, setRows] = useState<RankRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const go = useCallback(async () => {
    const kws = kwText.split('\n').map(s => s.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, MAX)
    if (!shop.trim() || kws.length === 0) { setErr('Enter a shop and at least one keyword.'); return }
    setLoading(true); setErr(''); setRows(null)

    const run = async (kw: string, shopParam: string): Promise<RankRow & { shopId: number }> => {
      const { data } = await axios.get(`/api/etsy/rank?q=${enc(kw)}&shop=${enc(shopParam)}`)
      if (!data.success) throw new Error(data.error || 'Rank check failed')
      const m = data.data.matches as { position: number; title: string; url: string }[]
      return { keyword: kw, best: m.length ? m[0].position : null, listing: m[0]?.title ?? '', url: m[0]?.url ?? '', onPage: m.length, total: data.data.totalResults, shopId: data.data.shopId }
    }

    try {
      // First call resolves the shop; reuse the numeric id for the rest (1 lookup, not N).
      const first = await run(kws[0], shop.trim())
      const shopId = String(first.shopId)
      const out: RankRow[] = [first]
      const rest = kws.slice(1)
      const CONC = 3
      for (let i = 0; i < rest.length; i += CONC) {
        const chunk = rest.slice(i, i + CONC)
        const res = await Promise.all(chunk.map(kw => run(kw, shopId).catch(() => ({ keyword: kw, best: null, listing: '', url: '', onPage: 0, total: 0, error: true } as RankRow))))
        out.push(...res)
      }
      out.sort((a, b) => (a.best ?? 999) - (b.best ?? 999))
      setRows(out)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Shop not found or rank check failed.')
    } finally { setLoading(false) }
  }, [shop, kwText])

  const ranked = rows?.filter(r => r.best != null).length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="18px">
        <SectionTitle>Where does your shop rank?</SectionTitle>
        <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#3a4444', marginBottom: 8 }}>Your shop (name or ID)</label>
            <input value={shop} onChange={e => setShop(e.target.value)} placeholder="e.g. CrochetArtPK"
              style={{ width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 100, padding: '10px 16px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#3a4444', marginBottom: 8 }}>Keywords ({MAX} max, one per line)</label>
            <textarea value={kwText} onChange={e => setKwText(e.target.value)} rows={3} placeholder={'crochet cardigan\nbaby crochet pattern'}
              style={{ width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontFamily: MONO, outline: 'none', color: '#1a1a1a', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
          </div>
        </div>
        <button onClick={go} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Checking…' : 'Check rankings →'}
        </button>
      </Card>

      {loading && <Loading label="Scanning the top 100 results per keyword…" />}
      {err && !loading && <ErrorBox>{err}</ErrorBox>}

      {rows && !loading && (
        <div>
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>{ranked}/{rows.length} keywords ranking in top 100</span>}>Rankings</SectionTitle>
          <div style={tableCard}>
            <div style={tableHead(GRID)}>
              {['Keyword', 'Best rank', 'Top ranking listing', 'Total results'].map(h => <span key={h} style={th}>{h}</span>)}
            </div>
            {rows.map(r => {
              const tone = rankTone(r.best)
              return (
                <div key={r.keyword} style={tableRow(GRID)}>
                  <span style={tdTitle}>{r.keyword}</span>
                  <span style={{ display: 'inline-flex', width: 'fit-content', padding: '2px 11px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: tone.bg, color: tone.color }}>{r.error ? 'error' : tone.label}</span>
                  {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ ...tdTitle, color: C.ink, textDecoration: 'none' }}>{r.listing}</a> : <span style={{ ...tdMono, color: '#a3a29a' }}>—</span>}
                  <span style={tdMono}>{formatNumber(r.total)}</span>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 12, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
            Rankings scan the top 100 listings in Etsy&apos;s relevance order (roughly the first two pages). Actual buyer results can vary by location and personalization.
          </p>
        </div>
      )}

      {!rows && !loading && !err && (
        <EmptyState icon="🎯" title="Check your search rankings" sub="Enter your shop and keywords to see where your listings appear in Etsy search" />
      )}
    </div>
  )
}
