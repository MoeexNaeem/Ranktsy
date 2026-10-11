'use client'
/**
 * Find Hot Products keeps its state in the page URL (hp* parameters) so a refresh,
 * a shared link or "open in new tab" lands on the same view, filters, page and
 * product. The dashboard's own ?tab= is left alone.
 *   hp     view: db | charts | mine | live
 *   hpf    database filters (JSON)       hps  sort       hpg  page
 *   hpc    top-charts settings (JSON)    hpid open product (listing id)
 */
export const HP_KEYS = ['hp', 'hpf', 'hps', 'hpg', 'hpc', 'hpid'] as const
type Key = typeof HP_KEYS[number]

export function readHp(key: Key): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}

export function readHpJson<T>(key: Key): T | null {
  const raw = readHp(key)
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

/** Set (string), clear (null) or keep (undefined) each key; replaces the history entry. */
export function writeHp(values: Partial<Record<Key, string | null>>): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) continue
    if (v === null || v === '') params.delete(k); else params.set(k, v)
  }
  const qs = params.toString()
  const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
  if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, '', url)
}

/** A link that opens this product's page in Find Hot Products (for new tabs and sharing). */
export function productHref(listingId: number): string {
  return `/dashboard?tab=hotproducts&hpid=${listingId}`
}

/** True when a click should be left to the browser (new tab / window / download). */
export function isModifiedClick(e: React.MouseEvent): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
}
