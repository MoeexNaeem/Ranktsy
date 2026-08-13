'use client'
import { memo } from 'react'
import { C } from '@/utils'
import type { CountryData } from '@/types'

const MONO = "'General Sans', sans-serif"

// Flag + a fixed colour PER COUNTRY (dataviz: colour follows the entity, never its
// rank — the US bar is the same colour wherever it lands). Country name + flag +
// % carry identity, so colour is secondary encoding.
const META: Record<string, { flag: string; color: string }> = {
  'United States': { flag: '🇺🇸', color: '#2E6DB4' },
  'Canada':        { flag: '🇨🇦', color: '#FB5E09' },
  'United Kingdom':{ flag: '🇬🇧', color: '#C08A12' },
  'Australia':     { flag: '🇦🇺', color: '#1F8A4C' },
  'Germany':       { flag: '🇩🇪', color: '#7A4FB5' },
  'France':        { flag: '🇫🇷', color: '#CF463A' },
  'Pakistan':      { flag: '🇵🇰', color: '#1F8A4C' },
  'India':         { flag: '🇮🇳', color: '#7A4FB5' },
}
const OTHER = { flag: '🌐', color: C.stone }

export const CountryChart = memo(function CountryChart({ data }: { data: CountryData[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.percentage), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15, padding: '4px 0' }}>
      {data.map(d => {
        const m = META[d.country] ?? OTHER
        return (
          <div key={d.country} style={{ display: 'flex', flexDirection: 'column', gap: 7,
            ...(d.selected ? { background: C.orangeFaint, borderRadius: 8, padding: '7px 9px', margin: '-3px -9px', boxShadow: `inset 0 0 0 1px ${C.orange}` } : null) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{m.flag}</span>
              <span style={{ flex: 1, fontSize: 14.5, color: C.ink, fontWeight: d.selected ? 700 : 500 }}>{d.country}</span>
              <span style={{ fontSize: 14.5, fontFamily: MONO, fontWeight: 600, color: C.ink }}>{d.percentage}%</span>
            </div>
            {/* Track + rounded bar, width scaled to the largest share so small
                values stay visible while the leader fills the row. */}
            <div style={{ height: 8, background: C.bone, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max((d.percentage / max) * 100, 4)}%`, background: m.color, borderRadius: 999, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )
      })}
      <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.5, marginTop: 2 }}>
        Share of Google search demand across tracked countries. Real Google Ads data.
      </p>
    </div>
  )
})
