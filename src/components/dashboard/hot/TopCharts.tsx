'use client'
/**
 * Find Hot Products, Top Charts (eHunt's "Etsy Products Ranking"):
 *  - Best Selling: most sales in the last 7 / 30 days
 *  - Rising: biggest jump in favorites this week vs last week (measured)
 *  - Most Favorited: most favorites gained in the last 7 / 30 days
 * "New Trending" limits all three to products listed in the last 90 days.
 * All from the product database: measured gains, sales labelled when estimated.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Icon } from '@/components/ui/Icon'
import { C, D, ACCENT, withAlpha, formatNumber } from '@/utils'
import { Card, SectionTitle, Loading, EmptyState, MONO } from '../kit'
import { dbToHot } from './ProductDatabase'
import { SaveButtons } from './SaveButtons'
import type { ApiResponse, DbProduct, DbProductsResponse, HotProduct } from '@/types'

const HUE = ACCENT.rose
const fmtDate = (ts?: number | null) => ts ? new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const money = (n: number) => `$${Math.round(n * 100) / 100}`

function useChart(sort: string, period: 7 | 30, fresh: boolean, cat: string, enabled: boolean) {
  return useQuery({
    queryKey: ['hot-chart', sort, period, fresh, cat],
    queryFn: async () => {
      const p = new URLSearchParams({ sort, limit: '20', meta: '1' })
      if (fresh) p.set('release', '90')
      if (cat) p.set('cat', cat)
      const { data } = await axios.get<ApiResponse<DbProductsResponse>>(`/api/etsy/hot-products/db?${p}`)
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
    enabled,
    staleTime: 1000 * 60 * 15,
    retry: false,
  })
}

function ChartList({ title, hint, accent, q, line, onOpen }: {
  title: string; hint: string; accent: string
  q: ReturnType<typeof useChart>; line: (p: DbProduct) => React.ReactNode; onOpen: (p: HotProduct) => void
}) {
  const rows = q.data?.products ?? []
  return (
    <Card pad={0}>
      <div style={{ padding: '14px 16px 10px', borderBottom: `3px solid ${accent}` }}>
        <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>top {rows.length || 20}</span>}>{title}</SectionTitle>
        <p style={{ fontSize: 11.5, color: C.graphite, marginTop: -8 }}>{hint}</p>
      </div>
      {q.isPending ? <div style={{ padding: 16 }}><Loading label="Ranking…" /></div>
        : q.isError ? <p style={{ padding: 16, fontSize: 13, color: C.graphite }}>Could not load this chart.</p>
        : rows.length === 0 ? <div style={{ padding: 16 }}><EmptyState icon="📈" title="Not enough history yet" sub="This chart fills in as our daily tracking builds up." /></div>
        : rows.map((p, i) => (
          <div key={p.listingId} onClick={() => onOpen(dbToHot(p))} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(dbToHot(p))}
            style={{ display: 'grid', gridTemplateColumns: '26px 64px 1fr auto', gap: 10, alignItems: 'center', padding: '11px 14px', borderBottom: `1px solid ${C.hair}`, cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: i < 3 ? accent : C.stone, textAlign: 'center' }}>#{i + 1}</span>
            {p.image ? <img src={p.image} alt="" style={{ width: 64, height: 64, borderRadius: 9, objectFit: 'cover' }} />
              : <div style={{ width: 64, height: 64, borderRadius: 9, background: C.bone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={18} color={C.stone} /></div>}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.title}</p>
              <p style={{ fontSize: 11, color: C.stone, marginTop: 3 }}>
                {fmtDate(p.created)}{p.shopName ? ` · ${p.shopName}` : ''}{p.priceUsd != null ? <> · <span style={{ color: HUE, fontWeight: 600 }}>{money(p.priceUsd)}</span></> : null}
              </p>
              <div style={{ fontSize: 12, fontFamily: MONO, marginTop: 3 }}>{line(p)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }} onClick={e => e.stopPropagation()}>
              <SaveButtons listingId={p.listingId} title={p.title} image={p.image} />
            </div>
          </div>
        ))}
    </Card>
  )
}

export function TopCharts({ onOpen }: { onOpen: (p: HotProduct) => void }) {
  const [fresh, setFresh] = useState(false)
  const [period, setPeriod] = useState<7 | 30>(7)
  const [cat, setCat] = useState('')
  const [started, setStarted] = useState(false)
  const best = useChart(period === 7 ? 'sales7' : 'sales30', period, fresh, cat, started)
  const rising = useChart('rising', 7, fresh, cat, started)
  const favs = useChart(period === 7 ? 'f7' : 'f30', period, fresh, cat, started)
  const cats = best.data?.categories ?? []
  const pill = (on: boolean): React.CSSProperties => ({ fontSize: 13, padding: '6px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', background: on ? withAlpha(HUE, 0.12) : 'transparent', color: on ? HUE : C.graphite, border: `1px solid ${on ? HUE : C.ash}` })
  const salesKey = period === 7 ? 'sales7' : 'sales30'
  const estKey = period === 7 ? 'salesEst' : 'salesEst30'
  const favKey = period === 7 ? 'f7' : 'f30'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card pad="16px 18px">
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>{best.data?.updatedAt ? `updated ${new Date(best.data.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'measured'}</span>}>Top Charts</SectionTitle>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setFresh(false)} style={pill(!fresh)}>Top chart</button>
          <button onClick={() => setFresh(true)} style={pill(fresh)}>New trending (listed in 90 days)</button>
          <span style={{ width: 1, height: 22, background: C.ash, margin: '0 4px' }} />
          <button onClick={() => setPeriod(7)} style={pill(period === 7)}>7 days</button>
          <button onClick={() => setPeriod(30)} style={pill(period === 30)}>30 days</button>
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ background: C.paper, border: `1px solid ${cat ? HUE : C.ash}`, borderRadius: 100, padding: '7px 12px', fontSize: 13, fontFamily: 'inherit', color: C.ink, cursor: 'pointer', marginLeft: 'auto' }}>
            <option value="">All categories</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      {!started ? (
        <Card>
          <EmptyState icon="🏆" title="Etsy's best sellers and fastest risers, measured" sub="Ranked from our own daily tracking. Opening the charts uses one browse credit for today; switching period, category or chart is free." />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setStarted(true)} style={{ background: HUE, color: '#fff', border: 'none', borderRadius: 100, padding: '11px 24px', fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Show the charts</button>
          </div>
        </Card>
      ) : (
        <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, alignItems: 'start' }}>
          <ChartList title="Best selling" hint={`Most sales in the last ${period} days`} accent={D.good} q={best} onOpen={onOpen}
            line={p => p[salesKey] == null ? <span style={{ color: C.stone }}>no data</span>
              : <span style={{ color: p[estKey] ? D.mid : D.good }}>{p[estKey] ? '~' : ''}{formatNumber(p[salesKey]!)} sales <span style={{ color: C.stone }}>· {formatNumber(p.reviews ?? 0)} reviews</span></span>} />
          <ChartList title="Rising" hint="Biggest jump in favorites, this week vs last week" accent={HUE} q={rising} onOpen={onOpen}
            line={p => <span style={{ color: HUE }}>+{formatNumber(p.fg7 ?? 0)}% favorites <span style={{ color: C.stone }}>· {formatNumber(p.f7 ?? 0)} this week</span></span>} />
          <ChartList title="Most favorited" hint={`Most favorites gained in the last ${period} days`} accent={D.series[5]} q={favs} onOpen={onOpen}
            line={p => <span style={{ color: D.series[5] }}>+{formatNumber(p[favKey] ?? 0)} favorites <span style={{ color: C.stone }}>· {formatNumber(p.favs ?? 0)} total</span></span>} />
        </div>
      )}
      <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
        Gains are measured between our daily readings and scaled to exactly 7 or 30 days. Sales in green are units that left stock; amber ~ are estimates from reviews gained.
        Rising compares favorites gained this week with last week, for products with at least 10 favorites last week.
      </p>
    </div>
  )
}
