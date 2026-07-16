'use client'
import { useCallback, useSyncExternalStore } from 'react'
import { STORAGE_KEY, LISTS_EVENT, migrate, loadLists as load, saveLists as save, type KList } from '@/lib/keyword-lists'

// Favourites are stored as a normal list inside the same localStorage bucket the
// Keyword Lists tab owns, so a star here shows up there (and vice-versa) with no
// separate sync path. Both go through lib/keyword-lists, which also carries the
// one-time migration off the old brand's key.
const FAVORITES = 'Favorites'

// localStorage is an external store, so this is a useSyncExternalStore subscription
// rather than useEffect+setState. getSnapshot must return a STABLE reference
// between changes or React re-renders forever — hence caching against the raw
// string and only reparsing when it actually differs.
const EMPTY: string[] = []
let cachedRaw: string | null = null
let cachedFavs: string[] = EMPTY

function subscribe(onChange: () => void): () => void {
  window.addEventListener(LISTS_EVENT, onChange) // same tab
  window.addEventListener('storage', onChange)   // other tabs
  return () => {
    window.removeEventListener(LISTS_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getSnapshot(): string[] {
  // Cheap after the first call, and guarantees a returning user's stars survive
  // the rename however they enter the app.
  migrate()
  const raw = localStorage.getItem(STORAGE_KEY) ?? '[]'
  if (raw === cachedRaw) return cachedFavs
  cachedRaw = raw
  try {
    const lists = JSON.parse(raw) as KList[]
    cachedFavs = lists.find(l => l.name === FAVORITES)?.keywords ?? EMPTY
  } catch {
    cachedFavs = EMPTY
  }
  return cachedFavs
}

// No localStorage during SSR — render unstarred, then hydrate.
function getServerSnapshot(): string[] { return EMPTY }

/** Get the Favorites list, creating it if this is the first star. */
function favList(lists: KList[]): KList {
  let fav = lists.find(l => l.name === FAVORITES)
  if (!fav) {
    fav = { id: 'favorites', name: FAVORITES, keywords: [] }
    lists.unshift(fav)
  }
  return fav
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback((keyword: string) => {
    const kw = keyword.toLowerCase().trim()
    if (!kw) return
    const lists = load()
    const fav = favList(lists)
    fav.keywords = fav.keywords.includes(kw)
      ? fav.keywords.filter(k => k !== kw)
      : [...fav.keywords, kw]
    save(lists)
  }, [])

  /** Bulk-add — used by the table's "save selected" action. */
  const addMany = useCallback((keywords: string[]) => {
    const clean = keywords.map(k => k.toLowerCase().trim()).filter(Boolean)
    if (!clean.length) return
    const lists = load()
    const fav = favList(lists)
    fav.keywords = [...new Set([...fav.keywords, ...clean])]
    save(lists)
  }, [])

  const isFavorite = useCallback(
    (keyword: string) => favorites.includes(keyword.toLowerCase().trim()),
    [favorites],
  )

  return { favorites, isFavorite, toggle, addMany }
}
