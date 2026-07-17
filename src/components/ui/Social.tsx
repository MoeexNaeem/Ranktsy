import React from 'react'

/**
 * Official social profiles — the single source of truth.
 *
 * Defined once and imported by both the footer and the contact page, so a
 * changed handle can never end up correct in one place and stale in the other.
 */
export interface SocialLink {
  name: string
  href: string
  /** Accessible label — these are icon-only links, so this is the only text a screen reader gets. */
  label: string
}

export const SOCIALS: SocialLink[] = [
  { name: 'youtube',   href: 'https://www.youtube.com/channel/UCN_HqL1neCkrLf_QndBvS5Q', label: 'Rankkw on YouTube' },
  { name: 'facebook',  href: 'https://www.facebook.com/profile.php?id=61591829587497',   label: 'Rankkw on Facebook' },
  { name: 'instagram', href: 'https://www.instagram.com/rank.kw/',                       label: 'Rankkw on Instagram' },
  { name: 'pinterest', href: 'https://www.pinterest.com/rankkwoffical/_profile/',        label: 'Rankkw on Pinterest' },
  { name: 'threads',   href: 'https://www.threads.com/@rank.kw',                         label: 'Rankkw on Threads' },
]

/**
 * Brand marks are filled paths on a 24×24 grid (not the outline set in Icon.tsx)
 * because a brand's logo has one correct shape — approximating it with strokes
 * reads as wrong rather than as a style choice.
 */
const MARKS: Record<string, React.ReactNode> = {
  youtube: (
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
  ),
  facebook: (
    <path d="M24 12.07C24 5.44 18.63.07 12 .07S0 5.44 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08v-3.47h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.38C19.61 23.02 24 18.06 24 12.07z" />
  ),
  instagram: (
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.17-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.17-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.66 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.72 2.13-1.38.66-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.72-1.46-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.85-10.41a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
  ),
  pinterest: (
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.43 7.63 11.17-.11-.95-.2-2.41.04-3.45.22-.94 1.4-5.96 1.4-5.96s-.36-.72-.36-1.78c0-1.67.97-2.91 2.17-2.91 1.02 0 1.52.77 1.52 1.69 0 1.03-.66 2.57-1 4-.28 1.2.6 2.18 1.79 2.18 2.15 0 3.8-2.27 3.8-5.54 0-2.9-2.08-4.92-5.05-4.92-3.44 0-5.46 2.58-5.46 5.25 0 1.04.4 2.15.9 2.76.1.12.11.22.08.34l-.34 1.36c-.05.22-.17.27-.4.16-1.5-.7-2.43-2.89-2.43-4.65 0-3.78 2.75-7.26 7.92-7.26 4.16 0 7.39 2.96 7.39 6.92 0 4.13-2.6 7.45-6.22 7.45-1.21 0-2.35-.63-2.74-1.38l-.75 2.84c-.27 1.04-1 2.35-1.49 3.15 1.12.35 2.31.53 3.55.53 6.63 0 12-5.37 12-12S18.63 0 12 0z" />
  ),
  threads: (
    <path d="M12.19 24h-.01c-3.58-.02-6.33-1.2-8.18-3.51C2.35 18.44 1.5 15.59 1.47 12.01v-.02c.03-3.58.88-6.43 2.53-8.48C5.85 1.2 8.6.02 12.18 0h.01c2.75.02 5.04.73 6.83 2.1 1.68 1.29 2.86 3.13 3.51 5.47l-2.04.57c-1.1-3.96-3.9-5.98-8.3-6.02-2.91.02-5.11.94-6.54 2.72C4.31 6.5 3.62 8.91 3.59 12c.03 3.09.72 5.5 2.06 7.16 1.43 1.78 3.63 2.7 6.54 2.72 2.62-.02 4.36-.63 5.8-2.05 1.65-1.61 1.62-3.59 1.09-4.8-.31-.71-.87-1.3-1.63-1.75-.19 1.35-.62 2.45-1.28 3.27-.89 1.1-2.14 1.7-3.73 1.79-1.2.07-2.36-.22-3.26-.8-1.06-.69-1.69-1.74-1.75-2.96-.07-1.19.41-2.29 1.33-3.08.88-.76 2.12-1.21 3.58-1.29a13.9 13.9 0 0 1 3.02.14c-.13-.74-.38-1.33-.75-1.76-.51-.59-1.31-.88-2.36-.89h-.03c-.84 0-1.99.23-2.72 1.32L7.73 7.85c.98-1.45 2.57-2.26 4.48-2.26h.04c3.19.02 5.1 1.98 5.29 5.39.11.05.22.09.32.14 1.49.7 2.58 1.76 3.15 3.07.8 1.82.87 4.79-1.55 7.16-1.85 1.81-4.09 2.63-7.27 2.65zm1.28-11.99c-.26 0-.53.01-.8.02-1.84.1-2.98.95-2.92 2.15.07 1.26 1.45 1.85 2.78 1.77 1.22-.06 2.82-.54 3.09-3.71a10.5 10.5 0 0 0-2.15-.24z" />
  ),
}

export function SocialIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="currentColor" aria-hidden="true" focusable="false"
      style={{ display: 'block' }}
    >
      {MARKS[name]}
    </svg>
  )
}

/**
 * Icon-only social row. `color`/`hoverColor` are passed in so the same component
 * works on the dark footer and the light contact page without either surface
 * hard-coding the other's palette.
 */
export function SocialRow({
  color, hoverColor, size = 18, gap = 14,
}: { color: string; hoverColor: string; size?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {SOCIALS.map(s => (
        <a
          key={s.name}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          title={s.label}
          style={{
            color,
            display: 'inline-flex',
            // 40px hit area around an 18px glyph — a bare icon is too small to
            // tap reliably on a phone.
            padding: 11,
            margin: -11,
            borderRadius: 8,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = hoverColor)}
          onMouseLeave={e => (e.currentTarget.style.color = color)}
        >
          <SocialIcon name={s.name} size={size} />
        </a>
      ))}
    </div>
  )
}
