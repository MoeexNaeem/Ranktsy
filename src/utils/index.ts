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

// ─── D — DATA palette ────────────────────────────────────────────────────────
// Deliberately separate from `C` (brand). The brand's "no green" rule governs
// chrome — nav, buttons, hero, CTA, footer. Data signals are the exception: a
// real green→amber→red scale reads faster than a monochrome one, so stats, KD
// scores, competition badges and charts use these.
//
// Rule: never use D.* for chrome, never use C.orange as a data signal.
export const D = {
  good:      '#1F8A4C',  goodBg:   'rgba(31,138,76,0.11)',   goodSoft:  '#DCEFE3',  // easy / low competition
  fair:      '#4E9A3F',  fairBg:   'rgba(78,154,63,0.11)',                          // easy-ish
  mid:       '#C08A12',  midBg:    'rgba(224,160,40,0.15)',   midSoft:   '#F7E9C9',  // medium
  warm:      '#D9702B',  warmBg:   'rgba(217,112,43,0.13)',                          // hard-ish
  hard:      '#CF463A',  hardBg:   'rgba(207,70,58,0.12)',    hardSoft:  '#F7DCD9',  // hard / high competition
  neutral:   '#6E6E64',  neutralBg:'rgba(110,110,100,0.10)',                         // no data

  // Categorical series — for multi-series charts (tags, categories, marketplaces).
  // Ordered for maximum adjacent contrast.
  series: ['#1F8A4C', '#2E6DB4', '#C08A12', '#CF463A', '#7A4FB5', '#0F9A9A', '#D9702B', '#6E6E64'] as const,
} as const

/** Keyword-difficulty / competition heat: 0 = easy (green) → 100 = hard (red). */
export function heatColor(score: number): string {
  if (score < 20) return D.good
  if (score < 40) return D.fair
  if (score < 60) return D.mid
  if (score < 80) return D.warm
  return D.hard
}

/**
 * ISO-3166 alpha-2 → flag emoji, by offsetting each letter into the Unicode
 * regional-indicator block. Derived rather than mapped, so it covers every
 * country Etsy can return — a hardcoded map silently drops the ones it misses.
 */
export function flag(iso: string | null | undefined): string {
  if (!iso || !/^[A-Za-z]{2}$/.test(iso)) return ''
  return String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

/** Competition level → {fg,bg}. Low is genuinely good news, so it reads green. */
export function compColor(level: 'Low' | 'Med' | 'High'): { fg: string; bg: string } {
  if (level === 'Low')  return { fg: D.good, bg: D.goodBg }
  if (level === 'High') return { fg: D.hard, bg: D.hardBg }
  return { fg: D.mid, bg: D.midBg }
}

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
