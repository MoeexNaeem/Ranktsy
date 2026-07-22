'use client'
import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTrendBuzz } from '@/hooks/useKeywords'
import { BarChart } from '@/components/charts/BarChart'
import { Card, SectionTitle, Loading, MONO } from '../kit'
import { C, ACCENT, withAlpha, formatNumber } from '@/utils'

const ICON = (d: React.ReactNode) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)

// Each launcher tile carries its destination tool's own accent hue, so the grid
// reads as a colourful, scannable spectrum that matches the nav rail.
const LAUNCH: { id: string; label: string; desc: string; color: string; icon: React.ReactNode }[] = [
  { id: 'myshop',     label: 'My Shop',          desc: 'Connect for sales insights', color: ACCENT.orange,  icon: ICON(<><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 21v-6h6v6"/></>) },
  { id: 'keywords',   label: 'Keyword research', desc: 'Volume, CTR & competition',  color: ACCENT.blue,    icon: ICON(<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>) },
  { id: 'buzz',       label: 'Trend Buzz',       desc: 'What’s heating up now',      color: ACCENT.rose,    icon: ICON(<><path d="M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z"/><line x1="9" y1="22" x2="15" y2="22"/></>) },
  { id: 'topsellers', label: 'Top Sellers',      desc: 'Leading shops per niche',    color: ACCENT.amber,   icon: ICON(<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></>) },
  { id: 'monthly',    label: 'Monthly Trends',   desc: 'Plan for peak season',       color: ACCENT.sky,     icon: ICON(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14l2 2 4-4"/></>) },
  { id: 'audit',      label: 'Listing Audit',    desc: 'Score a listing’s SEO',      color: ACCENT.green,   icon: ICON(<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>) },
  { id: 'shop',       label: 'Shop Analytics',   desc: 'Analyze any Etsy shop',      color: ACCENT.violet,  icon: ICON(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>) },
  { id: 'fees',       label: 'Fee Calculator',   desc: 'Profit & break-even',        color: ACCENT.emerald, icon: ICON(<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/></>) },
  { id: 'lists',      label: 'Keyword Lists',    desc: 'Save & organize',            color: ACCENT.slate,   icon: ICON(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>) },
]

export function OverviewTab({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { data: user } = useAuth()
  const { data: buzz, isLoading } = useTrendBuzz('')

  const top8 = useMemo(() => (buzz ?? []).slice(0, 8), [buzz])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Greeting */}
      <div>
        <h2 style={{ fontSize: 27, fontWeight: 500, color: C.ink, letterSpacing: '-0.03em' }}>
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
        </h2>
        <p style={{ fontSize: 15.5, color: C.graphite, marginTop: 5 }}>
          Here&apos;s what&apos;s moving on Etsy right now — then jump into any tool.
        </p>
      </div>

      {/* Quick launcher */}
      <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {LAUNCH.map(t => (
          <button key={t.id} onClick={() => onNavigate?.(t.id)}
            style={{ position: 'relative', textAlign: 'left', background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 16, padding: '18px 18px', cursor: 'pointer', fontFamily: 'inherit', transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s', overflow: 'hidden' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = t.color; e.currentTarget.style.boxShadow = `0 10px 24px ${withAlpha(t.color, 0.16)}` }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = C.ash; e.currentTarget.style.boxShadow = 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, background: withAlpha(t.color, 0.12), color: t.color, marginBottom: 14 }}>{t.icon}</span>
            <p style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, marginBottom: 3 }}>{t.label}</p>
            <p style={{ fontSize: 13, color: C.graphite }}>{t.desc}</p>
          </button>
        ))}
      </div>

      {/* Buzzing right now */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card>
          <SectionTitle right={<button onClick={() => onNavigate?.('buzz')} style={{ fontSize: 13, fontWeight: 500, fontFamily: MONO, color: C.orange, background: 'transparent', border: 'none', cursor: 'pointer' }}>See all →</button>}>
            Buzzing on Etsy right now
          </SectionTitle>
          {isLoading ? <Loading label="Reading live Etsy signals…" /> : (
            <BarChart axis="y" height={280} highlightMax
              labels={top8.map(b => b.keyword)} values={top8.map(b => b.heat)} />
          )}
          <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 12, fontFamily: MONO }}>
            Relative heat index from live listing tags + engagement — not absolute search volume.
          </p>
        </Card>

        <Card>
          <SectionTitle>Hot keywords</SectionTitle>
          {isLoading ? <Loading /> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {top8.map((b, i) => (
                <div key={b.keyword} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < top8.length - 1 ? `1px solid ${C.hair}` : 'none' }}>
                  <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 600, color: i < 3 ? C.orange : C.stone, width: 18 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.keyword}</span>
                  <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>{formatNumber(b.avgViews)} views</span>
                  <span style={{ fontSize: 14, fontFamily: MONO, color: C.orange, fontWeight: 600, width: 32, textAlign: 'right' }}>{b.heat}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
