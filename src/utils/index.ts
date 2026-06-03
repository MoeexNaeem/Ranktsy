export const C = {
  forest:      '#1c3a13',
  snow:        '#fcfcf7',
  pale:        '#d3fa99',
  frosted:     '#c4c7c4',
  warmGray:    '#eeeee9',
  mutedGreen:  '#757c5d',
  mutedYellow: '#9f995b',
  mutedTeal:   '#698e79',
  ghostGray:   '#b3b3b3',
  overlay:     '#666666',
} as const

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

export function formatPercent(n: number): string {
  return n.toFixed(1) + '%'
}

// Kept for any remaining imports
export function cn(...args: (string | undefined | false | null)[]): string {
  return args.filter(Boolean).join(' ')
}
