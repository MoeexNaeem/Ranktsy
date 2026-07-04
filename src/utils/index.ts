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

  // ── eRank-style surfaces (dense data-tool look) ────────────
  bg:          '#F6F5F2',        // app background
  card:        '#FFFFFF',        // card / table surface
  cardBorder:  '#EBE9E4',        // card + row borders
  headerBg:    '#FAF9F6',        // table header strip
  rowHover:    '#F7F6F2',        // table row hover
  inkSoft:     '#5A5A55',        // table body text
  inkFaint:    '#9A9A93',        // labels / captions

  // ── Semantic status (competition / difficulty) ─────────────
  success:     '#1E9E6A',  successBg: 'rgba(30,158,106,0.12)',   // Low competition = good
  warn:        '#B9791A',  warnBg:    'rgba(232,160,40,0.16)',   // Medium
  danger:      '#CF463A',  dangerBg:  'rgba(207,70,58,0.12)',    // High competition = hard

  // ── Huddle editorial language (flat, hairline, paper) ──────
  paper:       '#FFFFFF',        // page canvas / card base
  canvas:      '#F7F6F1',        // warm paper background
  bone:        '#ECEBE4',        // secondary tinted surface
  softOrange:  '#FBEADD',        // soft orange category tile
  hair:        '#DBD9D1',        // soft editorial hairline (dividers)
  hairInk:     '#2C2B27',        // crisp near-black hairline (Huddle card outline)
  ink:         '#1A1A18',        // display headline / high-contrast text
} as const

// Contrast guide (avoids the dark-text-on-orange readability bug):
//   • C.orange background  → always use C.snow (white) text
//   • C.charcoal background → always use C.snow (white) text
//   • C.orangeFaint / warmGray / snow backgrounds → use C.charcoal text

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
