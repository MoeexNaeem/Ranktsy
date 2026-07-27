'use client'
import { memo, useMemo, useState } from 'react'
import { Card, SectionTitle, MONO, EmptyState } from '../kit'
import { Star, ExportBtn, toCsv, downloadCsv, slugify } from '../controls'
import { useFavorites } from '@/hooks/useFavorites'
import { C, D, formatNumber } from '@/utils'
import type { KeywordIdea } from '@/types'

// Google's advertiser-competition band → semantic colour. LOW competition to
// advertise usually flags an under-served buyer intent — an opening for a seller.
const GCOMP: Record<string, { fg: string; bg: string; label: string }> = {
  LOW:    { fg: D.good, bg: D.goodBg, label: 'Low' },
  MEDIUM: { fg: D.mid,  bg: D.midBg,  label: 'Med' },
  HIGH:   { fg: D.hard, bg: D.hardBg, label: 'High' },
}

const CURSYM: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: '₨', INR: '₹' }
function fmtCpc(low: number | null, high: number | null, cur?: string | null): string {
  const sym = cur ? (CURSYM[cur] ?? `${cur} `) : ''
  const f = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2))
  if (low != null && high != null) return `${sym}${f(low)}–${sym}${f(high)}`
  const one = low ?? high
  return one != null ? `${sym}${f(one)}` : '—'
}

const GRID = '24px 2fr 0.9fr 0.85fr 1fr'

function CompPill({ band, index }: { band: string; index: number | null }) {
  const g = GCOMP[band]
  if (!g) return <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.stone }}>—</span>
  return (
    <span title={index != null ? `Google advertiser-competition index ${index}/100` : 'Google advertiser competition'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: g.bg, color: g.fg, fontSize: 12.5, fontFamily: MONO, fontWeight: 600, width: 'fit-content', cursor: 'help' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.fg, flexShrink: 0 }} />
      {g.label}{index != null ? ` · ${index}` : ''}
    </span>
  )
}

export const KeywordIdeasPanel = memo(function KeywordIdeasPanel({
  seed, ideas, currency, loading, configured, onSelect,
}: {
  seed: string
  ideas: KeywordIdea[]
  currency: string | null
  loading: boolean
  /** Google Ads connected? When false we show a connect prompt instead of "no results". */
  configured: boolean
  onSelect: (kw: string) => void
}) {
  const { isFavorite, toggle } = useFavorites()
  const [sort, setSort] = useState<'searches' | 'competition'>('searches')

  // "Openings" — real demand (volume) with low advertiser competition. The exact
  // signal a seller wants: people are searching, few are bidding.
  const openings = useMemo(
    () => ideas.filter(i => i.competition === 'LOW' && i.searches >= 100).length,
    [ideas],
  )

  const view = useMemo(() => {
    const rows = [...ideas]
    if (sort === 'searches') rows.sort((a, b) => b.searches - a.searches)
    else {
      const rank = { LOW: 0, MEDIUM: 1, HIGH: 2, UNSPECIFIED: 3 } as Record<string, number>
      rows.sort((a, b) => (rank[a.competition] - rank[b.competition]) || (b.searches - a.searches))
    }
    return rows
  }, [ideas, sort])

  const exportCsv = () => {
    const csv = toCsv(
      ['Keyword', 'Google searches/mo', 'Competition', 'Comp. index', `CPC low (${currency || 'acct'})`, `CPC high (${currency || 'acct'})`],
      view.map(i => [i.keyword, i.searches, i.competition, i.competitionIndex ?? '', i.cpcLow ?? '', i.cpcHigh ?? '']),
    )
    downloadCsv(`google-keyword-ideas-${slugify(seed)}.csv`, csv)
  }

  return (
    <Card>
      <SectionTitle right={
        <span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>Google Ads · Keyword Planner</span>
      }>
        Google Keyword Ideas
      </SectionTitle>
      <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.6, marginTop: -8, marginBottom: 14 }}>
        Keywords <strong style={{ color: C.ink }}>Google itself suggests</strong> for &ldquo;{seed}&rdquo; — genuine
        discovery beyond your Etsy tags. Rows with real search volume and{' '}
        <strong style={{ color: D.good }}>low advertiser competition</strong> are the openings.
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 40, background: '#e8e7e2', borderRadius: 8 }} />
          ))}
        </div>
      ) : !configured ? (
        <EmptyState icon="🔌" title="Connect Google Ads to unlock keyword ideas"
          sub="Google Keyword Planner powers this discovery. Once Google Ads credentials are set, real suggestions with volume, competition and CPC appear here." />
      ) : !ideas.length ? (
        <EmptyState icon="💡" title="No keyword ideas returned" sub={`Google had no suggestions for “${seed}”. Try a broader seed keyword.`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Toolbar */}
          <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>{ideas.length} ideas</span>
            {openings > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: D.good, background: D.goodBg, padding: '4px 10px', borderRadius: 100 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.good }} />
                {openings} low-competition opening{openings === 1 ? '' : 's'}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setSort(s => s === 'searches' ? 'competition' : 'searches')}
                style={{ height: 32, padding: '0 12px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, color: C.graphite, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>
                Sort: {sort === 'searches' ? 'Volume' : 'Competition'}
              </button>
              <ExportBtn onClick={exportCsv} />
            </div>
          </div>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '0 12px', fontSize: 11, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span />
            <span>Keyword</span>
            <span style={{ textAlign: 'right' }}>Searches/mo</span>
            <span>Competition</span>
            <span style={{ textAlign: 'right' }}>CPC{currency ? ` (${currency})` : ''}</span>
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {view.map(i => (
              <div key={i.keyword}
                style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center', padding: '9px 12px', borderTop: `1px solid ${C.hair}`, cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => onSelect(i.keyword)}>
                <Star on={isFavorite(i.keyword)} onClick={() => toggle(i.keyword)} />
                <span style={{ fontSize: 14, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.keyword}>{i.keyword}</span>
                <span style={{ fontSize: 14, fontFamily: MONO, color: '#2E6DB4', textAlign: 'right', fontWeight: 600 }}>{formatNumber(i.searches)}</span>
                <CompPill band={i.competition} index={i.competitionIndex} />
                <span style={{ fontSize: 13, fontFamily: MONO, color: i.cpcLow != null || i.cpcHigh != null ? C.ink : C.stone, textAlign: 'right' }}>{fmtCpc(i.cpcLow, i.cpcHigh, currency)}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6, marginTop: 4 }}>
            Real Google Ads Keyword Planner data (US). Competition is <em>advertiser</em> competition, not Etsy listing
            competition. CPC is the top-of-page bid range in your Ads account currency{currency ? ` (${currency})` : ''}.
          </p>
        </div>
      )}
    </Card>
  )
})
