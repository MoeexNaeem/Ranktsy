import { memo } from 'react'
import { C } from '@/utils'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * Twelve-bar calendar-month sparkline (Jan→Dec).
 *
 * Shows real counts — currently "listings created per month". It previously
 * rendered sine-wave arrays and highlighted the last three bars as "recent",
 * which implied a rolling search-history it never had. Calendar months have no
 * "recent" end, so the PEAK bar is highlighted instead.
 *
 * Renders nothing when there's no data — twelve zero-height bars would read as
 * "no activity" rather than "not measured".
 */
export const MiniTrend = memo(function MiniTrend({
  data, title,
}: { data: number[]; title?: string }) {
  if (!data?.length || data.every(v => v === 0)) {
    return <span style={{ fontSize: 12, color: C.stone, fontFamily: "'General Sans', sans-serif" }}>—</span>
  }
  const max = Math.max(...data, 1)
  const peak = data.indexOf(max)

  return (
    <div title={title} style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 34 }}>
      {data.map((v, i) => (
        <div key={i}
          title={`${MONTHS[i] ?? i + 1}: ${v} listing${v === 1 ? '' : 's'}`}
          style={{
            width: 5,
            borderRadius: 2,
            height: `${Math.max(v > 0 ? 12 : 4, Math.round((v / max) * 100))}%`,
            background: i === peak ? C.orange : '#D9D6CC',
            flexShrink: 0,
          }} />
      ))}
    </div>
  )
})
