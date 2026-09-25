'use client'
/**
 * A dashboard tool switch that is also a real link (/dashboard?tab=<id>), so right-click
 * "Open link in new tab", Ctrl/Cmd-click and middle-click open that tool in a new tab
 * (the dashboard reads ?tab= on load). A plain left click still switches in place.
 */
import Link from 'next/link'
import type { AnchorHTMLAttributes, MouseEvent } from 'react'

type Props = { tab: string; onOpen: () => void } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>

export function TabLink({ tab, onOpen, style, children, ...rest }: Props) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab / new-window gestures.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    onOpen()
  }
  return (
    <Link href={`/dashboard?tab=${tab}`} prefetch={false} onClick={onClick} style={{ textDecoration: 'none', ...style }} {...rest}>
      {children}
    </Link>
  )
}
