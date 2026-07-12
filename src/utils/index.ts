export const C = {
  // ── Brand palette — ONLY orange #FB5E09, dark #3D3E3B, parchment #F5F5EB ─
  orange:      '#FB5E09',        // primary action / CTA — the single chromatic charge
  orangeLight: '#FF7A2E',        // hover state
  orangeFaint: 'rgba(251,94,9,0.10)', // soft orange wash
  lime:        '#FB5E09',        // (no lime allowed) → aliased to orange as a safety net
  limeFaint:   'rgba(251,94,9,0.14)', // → orange wash
  softLime:    '#FCE7D8',        // → soft orange tile

  charcoal:    '#3D3E3B',        // dark island / footer / dark surfaces (brand dark)
  charcoalMid: '#6E6E64',        // graphite — secondary text
  charcoalSoft:'rgba(61,62,59,0.07)', // faint dividers
  deepCharcoal:'#3D3E3B',        // inverted surface

  // ── Neutrals (Perk parchment stack) ────────────────────────
  snow:        '#FFFFFF',        // pure white — highest surface / card fills
  offWhite:    '#F5F5EB',        // warm parchment page background (exact Perk)
  warmGray:    '#ECEBE1',        // tinted section surface
  lightGray:   '#D2D2C8',        // ash borders
  ghostGray:   '#919183',        // stone — placeholder / faint
  overlay:     '#6E6E64',        // graphite — muted body text

  // ── Data-tool surfaces (parchment) ─────────────────────────
  bg:          '#F5F5EB',        // app background — parchment
  card:        '#FFFFFF',        // card / table surface
  cardBorder:  '#E2E0D4',        // faint card + row borders
  headerBg:    '#F5F5EB',        // table header strip — parchment
  rowHover:    '#F5F5EB',        // table row hover
  inkSoft:     '#6E6E64',        // table body text — graphite
  inkFaint:    '#919183',        // labels / captions — stone

  // ── Semantic status (NO green — neutral "good", amber/red kept) ────
  success:     '#3D3E3B',  successBg: 'rgba(61,62,59,0.09)',     // Low competition = good → neutral ink
  warn:        '#C07A12',  warnBg:    'rgba(232,160,40,0.16)',   // Medium
  danger:      '#CF463A',  dangerBg:  'rgba(207,70,58,0.12)',    // High competition = hard

  // ── Editorial language (flat, borderless, tonal contrast) ──
  paper:       '#FFFFFF',        // page canvas / card base
  canvas:      '#F5F5EB',        // warm parchment background
  bone:        '#ECEBE1',        // secondary tinted surface
  softOrange:  '#FCE7D8',        // soft orange category tile
  hair:        '#D2D2C8',        // ash hairline (dividers) — Perk warm gray
  hairInk:     '#D2D2C8',        // ash card hairline (Perk: no crisp outlines)
  ash:         '#D2D2C8',        // Perk ash — borders / dividers
  graphite:    '#6E6E64',        // Perk graphite — muted copy
  stone:       '#919183',        // Perk stone — faint strokes
  ink:         '#3D3E3B',        // brand dark — headlines & body text
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
