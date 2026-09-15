'use client'
import { formatBytes } from '@/lib/chat-upload-constants'

/**
 * Renders a chat attachment: an image thumbnail (click to open full size) or a
 * document chip (click to open/download). Used in both the user chat widget and
 * the admin Messages thread. All bytes come from the auth-gated attachment route.
 */
export function ChatAttachmentView({ url, name, kind, size, onImage }: {
  url: string
  name: string
  kind: 'image' | 'file'
  size?: number | null
  onImage?: (url: string) => void   // optional lightbox handler; falls back to open in new tab
}) {
  if (kind === 'image') {
    return (
      <button
        onClick={() => (onImage ? onImage(url) : window.open(url, '_blank', 'noopener'))}
        title={name}
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', display: 'block', lineHeight: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} loading="lazy"
          style={{ maxWidth: 220, maxHeight: 220, width: 'auto', height: 'auto', borderRadius: 10, display: 'block', objectFit: 'cover' }} />
      </button>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit',
        background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, padding: '9px 12px', maxWidth: 240 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.75 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        {size != null && <span style={{ display: 'block', fontSize: 10.5, opacity: 0.6 }}>{formatBytes(size)}</span>}
      </span>
    </a>
  )
}
