'use client'
/**
 * The dashboard top-bar allowance meters: credits and keyword searches.
 *
 * One pill with two segments rather than two separate outlined pills. The old
 * pair read as clutter: two identical grey capsules, each spelling out
 * "2,500 / 2,500", where the denominator repeated on every render and the two
 * meters competed for attention instead of reading as one status.
 *
 * Here the remaining figure leads (exact, never abbreviated - knowing you have
 * 1,987 and not "2K" is the whole point), a hairline bar underneath carries the
 * proportion, and the full arithmetic lives in the tooltip.
 */
import { memo } from 'react'
import { C } from '@/utils'
import type { CreditState } from '@/lib/credits-client'

const SANS = "'General Sans',sans-serif"

const BoltIcon = ({ c }: { c: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)
const SearchIcon = ({ c }: { c: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

interface MeterProps {
  icon: (p: { c: string }) => React.ReactElement
  left: number
  limit: number | null   // null = unlimited
  label: string
  accent: string
  title: string
}

function Meter({ icon: Icon, left, limit, label, accent, title }: MeterProps) {
  const unlimited = limit == null || !Number.isFinite(limit)
  const out = !unlimited && left <= 0
  const low = !unlimited && !out && left <= limit * 0.2
  // Colour is the alarm, so it only departs from the brand accent when it must.
  const tone = out ? C.danger : low ? '#B45309' : accent
  const pct = unlimited ? 0 : Math.max(0, Math.min(1, left / Math.max(limit, 1)))

  return (
    <span title={title} style={{ display: 'inline-flex', flexDirection: 'column', gap: 5, padding: '7px 14px', minWidth: 0 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, lineHeight: 1 }}>
        <Icon c={tone} />
        <strong style={{ fontSize: 14.5, fontWeight: 700, color: out || low ? tone : C.ink, fontFamily: SANS, letterSpacing: '-0.01em' }}>
          {left.toLocaleString('en-US')}
        </strong>
        <span style={{ fontSize: 12, color: C.graphite, fontFamily: SANS, fontWeight: 500 }}>{label}</span>
      </span>
      {/* Proportion at a glance, so the denominator need not be spelled out. An
          unlimited meter counts up with no ceiling, so it gets no bar at all -
          a full one there would read as "all remaining", the opposite of true. */}
      <span aria-hidden style={{ display: 'block', height: 3, borderRadius: 2, background: unlimited ? 'transparent' : C.bone, overflow: 'hidden' }}>
        {!unlimited && <span style={{ display: 'block', height: '100%', width: `${pct * 100}%`, background: tone, borderRadius: 2, transition: 'width 0.35s ease' }} />}
      </span>
    </span>
  )
}

export const UsageMeters = memo(function UsageMeters({ credits }: { credits: CreditState | null }) {
  if (!credits) return null
  const s = credits.searches
  const sLimit = s ? s.limit : null
  const sUnlimited = !s || sLimit == null || !Number.isFinite(sLimit)
  const sLeft = s && !sUnlimited ? Math.max(0, (sLimit as number) - s.used) : 0

  return (
    <span className="rdash-badge" data-tour="credits"
      style={{ display: 'inline-flex', alignItems: 'stretch', background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 14, overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <Meter
        icon={BoltIcon}
        left={credits.credits}
        limit={credits.limit}
        label="credits"
        accent={C.orange}
        title={`${credits.credits.toLocaleString('en-US')} of ${credits.limit.toLocaleString('en-US')} daily credits left · 10 per tool use, including each keyword search · resets midnight UTC`}
      />
      {s && (
        <>
          <span aria-hidden style={{ width: 1, background: C.hair, flexShrink: 0 }} />
          <Meter
            icon={SearchIcon}
            left={sUnlimited ? s.used : sLeft}
            limit={sUnlimited ? null : (sLimit as number)}
            label={sUnlimited ? 'searches today' : 'searches'}
            accent="#2E6DB4"
            title={sUnlimited
              ? `${s.used.toLocaleString('en-US')} keyword searches today · unlimited on your plan`
              : `${sLeft.toLocaleString('en-US')} of ${(sLimit as number).toLocaleString('en-US')} daily keyword searches left · resets midnight UTC`}
          />
        </>
      )}
    </span>
  )
})
