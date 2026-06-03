import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

type DashboardTab = 'keywords' | 'trends' | 'shop'

interface AppState {
  // Keyword search
  activeKeyword:    string
  setActiveKeyword: (kw: string) => void

  // Dashboard
  activeTab:    DashboardTab
  setActiveTab: (tab: DashboardTab) => void

  // Recent searches (local)
  recentSearches:     string[]
  addRecentSearch:    (kw: string) => void
  clearRecentSearches: () => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      activeKeyword:    '',
      setActiveKeyword: (kw) => set({ activeKeyword: kw }),

      activeTab:    'keywords',
      setActiveTab: (tab) => set({ activeTab: tab }),

      recentSearches: [],
      addRecentSearch: (kw) =>
        set((state) => ({
          recentSearches: [
            kw,
            ...state.recentSearches.filter((s) => s !== kw),
          ].slice(0, 10), // keep last 10
        })),
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    { name: 'Ranksty' }
  )
)
