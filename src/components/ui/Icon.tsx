import React from 'react'

/**
 * Inline SVG icons for marketing pages.
 *
 * These replace emoji. The site sets `font-family: 'General Sans'`, which carries
 * no emoji glyphs, so an emoji fell back through the stack and rendered as a
 * blank tofu box on real devices (seen on iOS in the contact card). SVG renders
 * identically everywhere, scales cleanly, inherits colour, and matches the icon
 * set the dashboard already uses.
 *
 * Decorative by definition — always aria-hidden, since the adjacent heading
 * already carries the meaning for screen readers.
 */
export type IconName =
  | 'search' | 'sprout' | 'bolt' | 'handshake'
  | 'mail' | 'tool' | 'briefcase' | 'phone' | 'pin'
  | 'chart' | 'globe' | 'trophy' | 'tag' | 'check' | 'warning'

const PATHS: Record<IconName, React.ReactNode> = {
  search:    <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  sprout:    <><path d="M12 21c0-6 3-9 8-10-1 6-4 9-8 10z" /><path d="M12 21c0-5-2-8-6-9 1 5 3 8 6 9z" /><line x1="12" y1="21" x2="12" y2="14" /></>,
  bolt:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  handshake: <><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a2 2 0 0 1 0-2.8L17 5" /><path d="M7 17 4 14a2 2 0 0 1 0-2.8L9.2 6A2 2 0 0 1 12 6l1 1" /><path d="M17 5 14 8" /></>,
  mail:      <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
  tool:      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  phone:     <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  pin:       <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  chart:     <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  globe:     <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  trophy:    <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2z" /></>,
  tag:       <><path d="M20.59 13.41 13.4 20.6a2 2 0 0 1-2.82 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>,
  check:     <polyline points="20 6 9 17 4 12" />,
  warning:   <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
}

export function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 1.6, style }: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
      style={{ display: 'block', ...style }}
    >
      {PATHS[name]}
    </svg>
  )
}
