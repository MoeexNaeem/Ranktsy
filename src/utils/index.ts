export const C = {
  // ── Brand palette ──────────────────────────────────────────
  orange:      '#FF6008',        // primary CTA / accents
  orangeLight: '#FF7A2E',        // hover state
  orangeFaint: 'rgba(255,96,8,0.10)', // soft backgrounds
  charcoal:    '#3C3C3C',        // primary text / dark surfaces
  charcoalMid: '#5A5A5A',        // secondary text
  charcoalSoft:'rgba(60,60,60,0.08)', // borders / dividers

  // ── Neutrals ───────────────────────────────────────────────
  snow:        '#FFFFFF',        // pure white
  offWhite:    '#F8F7F5',        // page background
  warmGray:    '#F0EFED',        // card backgrounds / sections
  lightGray:   '#E5E4E2',        // borders
  ghostGray:   '#B0B0B0',        // placeholder / disabled text
  overlay:     '#666666',        // muted body text

  // ── Legacy aliases kept for any missed references ───────────
  forest:      '#3C3C3C',        // mapped → charcoal
  pale:        '#FF6008',        // mapped → orange
  mutedGreen:  '#5A5A5A',        // mapped → charcoalMid
  mutedYellow: '#FF7A2E',        // mapped → orangeLight
  mutedTeal:   '#3C3C3C',        // mapped → charcoal
  frosted:     '#E5E4E2',        // mapped → lightGray
} as const

export function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

export function formatPercent(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(1) + '%'
}

// Kept for any remaining imports
export function cn(...args: (string | undefined | false | null)[]): string {
  return args.filter(Boolean).join(' ')
}
