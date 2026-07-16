'use client'
import { memo, useMemo } from 'react'
import { C, D } from '@/utils'
import type { TagCloudItem } from '@/types'

const MONO = "'General Sans',sans-serif"

/**
 * Weighted tag cloud. Size AND colour both encode frequency, so the dominant
 * tags read at a glance rather than needing the reader to compare font sizes.
 * Tags are shuffled deterministically (by string hash) so the layout is stable
 * across renders but doesn't just read as a sorted list.
 */
export const TagCloud = memo(function TagCloud({
  tags, onSelect, height = 300,
}: { tags: TagCloudItem[]; onSelect?: (tag: string) => void; height?: number }) {
  const items = useMemo(() => {
    if (!tags.length) return []
    const top = tags.slice(0, 45)
    const max = Math.max(...top.map(t => t.count))
    const min = Math.min(...top.map(t => t.count))
    const span = Math.max(1, max - min)

    return top
      .map(t => {
        const w = (t.count - min) / span            // 0…1 within this result set
        const size = 12 + Math.round(w * 26)        // 12 → 38px
        // Colour by weight: the heaviest tags are the ones worth acting on.
        const color = w > 0.72 ? D.good : w > 0.45 ? '#2E6DB4' : w > 0.22 ? C.graphite : C.stone
        // Stable pseudo-shuffle: hash the tag so order never changes between renders.
        const hash = [...t.tag].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
        return { ...t, size, color, weight: w > 0.45 ? 500 : 400, hash }
      })
      .sort((a, b) => a.hash - b.hash)
  }, [tags])

  if (!items.length) {
    return <div style={{ height, display: 'grid', placeItems: 'center', color: C.stone, fontSize: 14 }}>No tags found</div>
  }

  return (
    <div style={{
      height, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center',
      justifyContent: 'center', gap: '4px 12px', padding: '10px 4px', alignContent: 'center',
    }}>
      {items.map(t => (
        <button
          key={t.tag}
          onClick={() => onSelect?.(t.tag)}
          title={`${t.tag} — in ${t.count} listing${t.count === 1 ? '' : 's'} (${t.pct}%)${onSelect ? ' · click to search' : ''}`}
          style={{
            fontSize: t.size, fontWeight: t.weight, color: t.color, fontFamily: MONO,
            background: 'transparent', border: 'none', padding: '1px 3px', borderRadius: 5,
            cursor: onSelect ? 'pointer' : 'default', lineHeight: 1.25, letterSpacing: '-0.01em',
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => { if (onSelect) { e.currentTarget.style.color = C.orange; e.currentTarget.style.background = C.orangeFaint } }}
          onMouseLeave={e => { e.currentTarget.style.color = t.color; e.currentTarget.style.background = 'transparent' }}>
          {t.tag}
        </button>
      ))}
    </div>
  )
})
