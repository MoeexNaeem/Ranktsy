'use client'
/**
 * "Why it moved": opens under a Rank Movement row. Shows what we measured on the
 * listing around its move (edits, price, stock, pace of reviews and favorites),
 * how the keyword sits in its title and tags, and who passed whom. It never states
 * a cause: Etsy's formula is private, so these are facts that moved WITH the rank.
 */
import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { MONO } from '../kit'
import { Shimmer } from '../skeletons'
import { C, D } from '@/utils'
import type { ApiResponse } from '@/types'
import type { RankExplanation, RankEvent, KeywordFit, PaceMetric, PassedListing } from '@/lib/rank-explain'

export interface WhyMover {
  listingId: number
  change: number
  firstDay: string
  latestDay: string
  series: { day: string; position: number }[]
}
export interface WhySignals {
  freeShippingPct: number | null
  withVideoPct: number | null
  starSellerPct: number | null
  medianImages: number | null
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
/** "Sep 28", or "Sep 26 to 28" when the change happened between two captures. */
const when = (e: RankEvent) => (dayGap(e.prevDay, e.day) > 1 ? `${fmtDay(e.prevDay)} to ${fmtDay(e.day)}` : fmtDay(e.day))

const label: React.CSSProperties = { fontSize: 10.5, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }
const box: React.CSSProperties = { border: `1px solid ${C.hair}`, borderRadius: 10, padding: '12px 14px', background: C.paper, minWidth: 0 }

function titlePlace(f: KeywordFit | null): string {
  if (!f || f.inTitle == null) return '-'
  if (!f.inTitle || f.titleIndex == null) return 'Not in title'
  if (f.titleIndex === 0) return 'Start of title'
  if (f.titleIndex < 40) return 'First 40 characters'
  return 'Later in title'
}

/** One plain sentence on how an edit changed the keyword's place in the title. */
function titleEffect(a: KeywordFit, b: KeywordFit): string | null {
  if (a.inTitle == null || b.inTitle == null) return null
  if (!a.inTitle && b.inTitle) return b.titleIndex === 0 ? 'Keyword added at the start of the title' : 'Keyword added to the title'
  if (a.inTitle && !b.inTitle) return 'Keyword removed from the title'
  if (a.inTitle && b.inTitle && a.titleIndex != null && b.titleIndex != null && b.titleIndex !== a.titleIndex) {
    return b.titleIndex < a.titleIndex ? 'Keyword moved earlier in the title' : 'Keyword moved later in the title'
  }
  return null
}

function EventRow({ e }: { e: RankEvent }) {
  let icon = '•', head = '', tone: string = C.ink
  let body: React.ReactNode = null
  switch (e.kind) {
    case 'title': {
      icon = '✎'; head = 'Title edited'
      const fx = titleEffect(e.fitBefore, e.fitAfter)
      body = (
        <>
          {fx && <p style={{ margin: '2px 0 4px', fontSize: 12.5, fontWeight: 600, color: e.fitAfter.inTitle ? D.good : D.hard }}>{fx}</p>}
          <p title={e.from} style={{ margin: 0, fontSize: 12, color: C.stone, textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.from}</p>
          <p title={e.to} style={{ margin: '2px 0 0', fontSize: 12, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.to}</p>
        </>
      )
      break
    }
    case 'tags': {
      icon = '#'; head = `Tags edited: ${e.added.length} added, ${e.removed.length} removed`
      const exact = e.fitBefore.exactTag === false && e.fitAfter.exactTag ? 'Exact keyword tag added' : e.fitBefore.exactTag && e.fitAfter.exactTag === false ? 'Exact keyword tag removed' : null
      body = (
        <>
          {exact && <p style={{ margin: '2px 0 4px', fontSize: 12.5, fontWeight: 600, color: e.fitAfter.exactTag ? D.good : D.hard }}>{exact}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
            {e.added.map(t => <span key={`+${t}`} style={{ fontSize: 11.5, padding: '2px 7px', borderRadius: 6, background: 'rgba(22,163,74,0.10)', color: D.good }}>+ {t}</span>)}
            {e.removed.map(t => <span key={`-${t}`} style={{ fontSize: 11.5, padding: '2px 7px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', color: D.hard, textDecoration: 'line-through' }}>{t}</span>)}
          </div>
        </>
      )
      break
    }
    case 'sale':
      icon = '%'; head = e.started ? `Sale started${e.pct != null ? ` (${e.pct}% off)` : ''}` : 'Sale ended'
      break
    case 'stock':
      icon = '▣'; head = e.outOfStock ? 'Sold out' : 'Back in stock'; tone = e.outOfStock ? D.hard : D.good
      break
    case 'rating':
      icon = '★'; head = `Rating ${e.from.toFixed(1)} → ${e.to.toFixed(1)}`; tone = e.to > e.from ? D.good : D.hard
      break
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.hair}` }}>
      <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, background: C.canvas, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: C.graphite }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: tone }}>{head}</span>
          <span style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone, whiteSpace: 'nowrap' }}>{when(e)}</span>
        </div>
        {body}
      </div>
    </div>
  )
}

/** 74.89 -> "75", 0.67 -> "0.7", 0 -> "0". */
const perDay = (v: number) => (v >= 10 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 10) / 10))

function Pace({ name, p }: { name: string; p: PaceMetric }) {
  const ratio = p.perDay != null && p.beforePerDay != null && p.beforePerDay > 0 ? p.perDay / p.beforePerDay : null
  const trend = ratio == null ? null : ratio >= 1.25 ? 'up' : ratio <= 0.8 ? 'down' : 'flat'
  return (
    <div style={box}>
      <p style={label}>{name}</p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: p.gained != null ? C.ink : C.stone }}>
        {p.gained != null ? `+${p.gained.toLocaleString('en-US')}` : '-'}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 11.5, fontFamily: MONO, color: C.graphite }}>
        {p.perDay != null ? `${perDay(p.perDay)}/day` : 'not measured'}
        {p.beforePerDay != null && <> · before {perDay(p.beforePerDay)}/day</>}
      </p>
      {trend && trend !== 'flat' && (
        <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: trend === 'up' ? D.good : D.hard }}>
          {trend === 'up' ? `${ratio!.toFixed(1)}× faster` : `${(1 / ratio!).toFixed(1)}× slower`}
        </p>
      )}
    </div>
  )
}

function FitTable({ start, now }: { start: KeywordFit | null; now: KeywordFit | null }) {
  const rows: [string, (f: KeywordFit | null) => string][] = [
    ['Exact phrase in title', titlePlace],
    ['All keyword words in title', f => (f?.allWordsInTitle == null ? '-' : f.allWordsInTitle ? 'Yes' : 'No')],
    ['Exact keyword tag', f => (f?.exactTag == null ? '-' : f.exactTag ? 'Yes' : 'No')],
    ['Tags with the phrase', f => (f?.phraseTags == null ? '-' : String(f.phraseTags))],
    ['Tags with a keyword word', f => (f?.wordTags == null ? '-' : String(f.wordTags))],
  ]
  return (
    <div style={box}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
        <span style={label}>Keyword fit</span><span style={label}>At start</span><span style={label}>Now</span>
        {rows.map(([k, fn]) => {
          const a = fn(start), b = fn(now)
          return [
            <span key={`${k}k`} style={{ fontSize: 12.5, color: C.graphite }}>{k}</span>,
            <span key={`${k}a`} style={{ fontSize: 12.5, color: C.graphite }}>{a}</span>,
            <span key={`${k}b`} style={{ fontSize: 12.5, fontWeight: a !== b ? 700 : 500, color: C.ink }}>{b}</span>,
          ]
        })}
      </div>
    </div>
  )
}

function PassedList({ title, items, total, note }: { title: string; items: PassedListing[]; total: number; note?: string }) {
  if (!total) return null
  return (
    <div style={box}>
      <p style={label}>{title}: {total}</p>
      {note && <p style={{ margin: '-4px 0 8px', fontSize: 12, color: C.graphite }}>{note}</p>}
      {items.map(p => (
        <div key={p.listingId} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '5px 0', borderTop: `1px solid ${C.hair}` }}>
          <a href={`https://www.etsy.com/listing/${p.listingId}`} target="_blank" rel="noopener noreferrer" title={p.title}
            style={{ fontSize: 12.5, color: C.ink, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.title || `Listing ${p.listingId}`}{p.shopName ? <span style={{ color: C.stone }}> · {p.shopName}</span> : null}
          </a>
          <span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite, whiteSpace: 'nowrap' }}>{p.was != null ? `#${p.was}` : 'new'} → #{p.now}</span>
        </div>
      ))}
    </div>
  )
}

function Details({ d, s }: { d: NonNullable<RankExplanation['details']>; s: WhySignals | null }) {
  const yn = (v: boolean | null) => (v == null ? '-' : v ? 'Yes' : 'No')
  const cells: [string, string, string | null][] = [
    ['Free shipping', yn(d.freeShipping), s?.freeShippingPct != null ? `${s.freeShippingPct}% of top listings` : null],
    ['Video', yn(d.hasVideo), s?.withVideoPct != null ? `${s.withVideoPct}% of top listings` : null],
    ['Photos', d.imageCount != null ? String(d.imageCount) : '-', s?.medianImages != null ? `top listings: ${s.medianImages}` : null],
    ['Star Seller', yn(d.starSeller), s?.starSellerPct != null ? `${s.starSellerPct}% of top listings` : null],
  ]
  return (
    <div style={box}>
      <p style={label}>This listing today</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {cells.map(([k, v, cmp]) => (
          <div key={k}>
            <p style={{ margin: 0, fontSize: 11.5, color: C.graphite }}>{k}</p>
            <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: v === '-' ? C.stone : C.ink }}>{v}</p>
            {cmp && <p style={{ margin: '1px 0 0', fontSize: 11, fontFamily: MONO, color: C.stone }}>{cmp}</p>}
          </div>
        ))}
      </div>
      {d.badges.length > 0 && <p style={{ margin: '10px 0 0', fontSize: 12, color: C.graphite }}>Badges: {d.badges.join(', ')}</p>}
    </div>
  )
}

function RankChart({ series, events }: { series: WhyMover['series']; events: RankEvent[] }) {
  const data = useMemo(() => series.map(p => ({ day: p.day, label: fmtDay(p.day), position: p.position })), [series])
  // Mark each edit on the nearest captured day at or after it.
  const marks = useMemo(() => {
    const out = new Map<string, Set<string>>()
    for (const e of events) {
      const at = series.find(p => p.day >= e.day)?.day
      if (!at) continue
      const tag = e.kind === 'title' ? 'Title' : e.kind === 'tags' ? 'Tags' : e.kind === 'sale' ? 'Sale' : e.kind === 'stock' ? 'Stock' : 'Rating'
      if (!out.has(at)) out.set(at, new Set())
      out.get(at)!.add(tag)
    }
    return [...out].map(([day, tags]) => ({ x: fmtDay(day), text: [...tags].join(' + ') }))
  }, [events, series])
  if (data.length < 2) return null
  const ps = data.map(d => d.position)
  return (
    <div style={{ ...box, padding: '12px 8px 4px' }}>
      <p style={{ ...label, paddingLeft: 6 }}>Position by day (1 is best)</p>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9a9a92' }} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.06)' }} minTickGap={18} />
          <YAxis reversed allowDecimals={false} domain={[Math.max(1, Math.min(...ps) - 2), Math.max(...ps) + 2]} tick={{ fontSize: 11, fill: '#9a9a92' }} tickLine={false} axisLine={false} width={34} tickFormatter={v => `#${v}`} />
          <Tooltip formatter={(v) => [`#${v}`, 'Position']} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 10, border: `1px solid ${C.hair}`, fontSize: 12 }} />
          {marks.map(m => (
            <ReferenceLine key={m.x} x={m.x} stroke={C.orange} strokeDasharray="4 3" label={{ value: m.text, position: 'insideTopLeft', fontSize: 10.5, fill: C.orange }} />
          ))}
          <Line type="monotone" dataKey="position" stroke={C.ink} strokeWidth={2.2} dot={{ r: 2.5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export const RankWhyPanel = memo(function RankWhyPanel({ query, country, mover, signals }: {
  query: string; country?: string; mover: WhyMover; signals: WhySignals | null
}) {
  const q = useQuery({
    queryKey: ['rank-explain', query.toLowerCase().trim(), mover.listingId, mover.firstDay, mover.latestDay, country ?? ''],
    queryFn: async ({ signal }) => {
      const sp = new URLSearchParams({ q: query, id: String(mover.listingId), from: mover.firstDay, to: mover.latestDay })
      if (country) sp.set('country', country)
      const r = await fetch(`/api/etsy/rank-explain?${sp}`, { signal })
      const j = (await r.json()) as ApiResponse<RankExplanation>
      if (!j.success || !j.data) throw new Error(j.error ?? 'Failed')
      return j.data
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  })

  if (q.isLoading) {
    return <div style={{ padding: '14px', display: 'grid', gap: 10, background: C.canvas }}>{[150, 54, 54].map((h, i) => <Shimmer key={i} h={h} r={10} />)}</div>
  }
  if (q.isError || !q.data) {
    return <p style={{ padding: '14px', margin: 0, fontSize: 13, color: C.graphite }}>{q.error instanceof Error ? q.error.message : 'Could not load the change history.'}</p>
  }
  const x = q.data
  const dropped = mover.change < 0
  return (
    <div style={{ padding: '14px 14px 16px', background: C.canvas, display: 'grid', gap: 12 }}>
      <RankChart series={mover.series} events={x.events} />

      <div style={box}>
        <p style={label}>What changed on this listing</p>
        {x.events.length
          ? x.events.map((e, i) => <EventRow key={`${e.kind}-${e.day}-${i}`} e={e} />)
          : <p style={{ margin: 0, fontSize: 13, color: C.graphite }}>No title, tag, sale, stock or rating changes measured ({x.measuredDays} days measured).</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Pace name="New reviews" p={x.pace.reviews} />
        <Pace name="New favorites" p={x.pace.favorites} />
        <Pace name="New views" p={x.pace.views} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        <FitTable start={x.fitAtStart} now={x.fitNow} />
        {x.details && (x.details.freeShipping != null || x.details.hasVideo != null || x.details.imageCount != null || x.details.starSeller != null || x.details.badges.length > 0) && <Details d={x.details} s={signals} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        <PassedList
          title={dropped ? 'Listings that passed it' : 'Listings that also passed it'}
          items={x.passedBy.sample}
          total={x.passedBy.count}
          note={x.passedBy.notSeenBefore ? `${x.passedBy.notSeenBefore} were not in the results on ${fmtDay(x.from)}` : undefined}
        />
        <PassedList title="Listings it passed" items={x.passed.sample} total={x.passed.count} />
      </div>
    </div>
  )
})
