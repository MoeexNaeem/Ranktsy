'use client'
/**
 * Saved keyword lists — the single owner of the localStorage bucket that both
 * the Keyword Lists tab and the star control read.
 *
 * The key is namespaced by brand, so the Ranktsy → Rankkw rename would have
 * silently orphaned every existing user's saved lists. `migrate()` moves them
 * across once, on first read.
 */
export interface KList { id: string; name: string; keywords: string[] }

export const STORAGE_KEY = 'rankkw:keyword-lists'
export const LISTS_EVENT = 'rankkw:lists-changed'

/** Keys this data has lived under before. Newest last. */
const LEGACY_KEYS = ['ranktsy:keyword-lists']

/**
 * One-time move from any previous brand's key. Runs before every read, but the
 * work only happens once: after a successful copy the legacy key is removed.
 * Never throws — a storage failure must not take the tab down with it.
 */
export function migrate(): void {
  if (typeof window === 'undefined') return
  try {
    // Don't clobber data already under the current key.
    if (localStorage.getItem(STORAGE_KEY)) {
      LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
      return
    }
    for (const old of LEGACY_KEYS) {
      const v = localStorage.getItem(old)
      if (v) {
        localStorage.setItem(STORAGE_KEY, v)
        localStorage.removeItem(old)
        return
      }
    }
  } catch {
    /* private mode / quota — fall through to an empty list */
  }
}

export function loadLists(): KList[] {
  if (typeof window === 'undefined') return []
  migrate()
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed as KList[] : []
  } catch {
    return []
  }
}

export function saveLists(lists: KList[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
    // The native `storage` event only fires in OTHER tabs, so same-tab listeners
    // need an explicit nudge.
    window.dispatchEvent(new Event(LISTS_EVENT))
  } catch (e) {
    console.error('[KeywordLists] save failed:', e)
  }
}
