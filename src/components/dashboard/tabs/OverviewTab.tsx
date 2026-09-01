'use client'
import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTrendBuzz } from '@/hooks/useKeywords'
import { Card, SectionTitle, Loading, MONO } from '../kit'
import { C, ACCENT, withAlpha, formatNumber } from '@/utils'
import { AnimIcon, DASH_ICON } from '@/components/ui/AnimIcon'

// Each launcher tile carries its destination tool's own accent hue, so the grid
// reads as a colourful, scannable spectrum that matches the nav rail. Icons are
// animated Lordicons (play on card hover) via the shared DASH_ICON map.
const LAUNCH: { id: string; label: string; desc: string; color: string }[] = [
  { id: 'myshop',     label: 'My Shop',          desc: 'Connect for sales insights', color: ACCENT.orange },
  { id: 'keywords',   label: 'Keyword research', desc: 'Volume, CTR & competition',  color: ACCENT.blue },
  { id: 'buzz',       label: 'Trend Buzz',       desc: 'What’s heating up now',      color: ACCENT.rose },
  { id: 'topsellers', label: 'Top Sellers',      desc: 'Leading shops per niche',    color: ACCENT.amber },
  { id: 'monthly',    label: 'Monthly Trends',   desc: 'Plan for peak season',       color: ACCENT.sky },
  { id: 'audit',      label: 'Listing Audit',    desc: 'Score a listing’s SEO',      color: ACCENT.green },
  { id: 'shop',       label: 'Shop Analytics',   desc: 'Analyze any Etsy shop',      color: ACCENT.violet },
  { id: 'fees',       label: 'Fee Calculator',   desc: 'Profit & break-even',        color: ACCENT.emerald },
  { id: 'lists',      label: 'Keyword Lists',    desc: 'Save & organize',            color: ACCENT.slate },
]

export function OverviewTab({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { data: user } = useAuth()
  const { data: buzz, isLoading } = useTrendBuzz('')

  const top8 = useMemo(() => (buzz ?? []).slice(0, 8), [buzz])
  const maxHeat = useMemo(() => Math.max(...top8.map(b => b.heat), 1), [top8])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Greeting */}
      <div>
        <h2 style={{ fontSize: 27, fontWeight: 500, color: C.ink, letterSpacing: '-0.03em' }}>
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h2>
        <p style={{ fontSize: 15.5, color: C.graphite, marginTop: 5 }}>
          Here&apos;s what&apos;s moving on Etsy right now - then jump into any tool.
        </p>
      </div>

      {/* Quick launcher */}
      <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {LAUNCH.map(t => (
          <button key={t.id} onClick={() => onNavigate?.(t.id)}
            style={{ position: 'relative', textAlign: 'left', background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 16, padding: '18px 18px', cursor: 'pointer', fontFamily: 'inherit', transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s', overflow: 'hidden' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = t.color; e.currentTarget.style.boxShadow = `0 10px 24px ${withAlpha(t.color, 0.16)}` }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = C.ash; e.currentTarget.style.boxShadow = 'none' }}>
            <span style={{ display: 'inline-flex', color: t.color, marginBottom: 14 }}><AnimIcon src={DASH_ICON[t.id]} size={32} color={t.color} target="button" /></span>
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
          {isLoading ? <Loading label="Reading market signals…" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {top8.map((b, i) => {
                const pct = Math.max(6, Math.round((b.heat / maxHeat) * 100))
                return (
                  <div key={b.keyword} className="rbuzz-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(96px,160px) 1fr 34px', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.keyword}</span>
                    <div style={{ height: 13, background: C.bone, borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: withAlpha(C.orange, Math.max(0.4, 0.95 - i * 0.07)), borderRadius: 999, transition: 'width 0.7s ease' }} />
                    </div>
                    <span style={{ fontSize: 14, fontFamily: MONO, fontWeight: 600, color: C.orange, textAlign: 'right' }}>{b.heat}</span>
                  </div>
                )
              })}
            </div>
          )}
          <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 12, fontFamily: MONO }}>
            Relative heat index from live listing tags + engagement - not absolute search volume.
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
