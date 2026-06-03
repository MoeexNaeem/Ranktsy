'use client'
import { useState, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { C } from '@/utils'

const KeywordsTab    = dynamic(() => import('./tabs/KeywordsTab').then(m => ({ default: m.KeywordsTab })), { ssr: false })
const ListingsTab    = dynamic(() => import('./tabs/ListingsTab').then(m => ({ default: m.ListingsTab })), { ssr: false })
const CompetitorsTab = dynamic(() => import('./tabs/CompetitorsTab').then(m => ({ default: m.CompetitorsTab })), { ssr: false })
const TrendsTab      = dynamic(() => import('./tabs/TrendsTab').then(m => ({ default: m.TrendsTab })), { ssr: false })
const ShopTab        = dynamic(() => import('./tabs/ShopTab').then(m => ({ default: m.ShopTab })), { ssr: false })
const TagOptimizerTab= dynamic(() => import('./tabs/TagOptimizerTab').then(m => ({ default: m.TagOptimizerTab })), { ssr: false })

type TabId = 'keywords' | 'listings' | 'competitors' | 'trends' | 'shop' | 'tags'

const TABS: { id: TabId; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'keywords',    label: 'Keywords',     description: 'Research search volume & CTR',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> },
  { id: 'listings',    label: 'Listings',     description: 'Browse live Etsy listings',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { id: 'competitors', label: 'Competitors',  description: 'Analyze top sellers',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: 'trends',      label: 'Trends',       description: 'Track search trends',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
  { id: 'shop',        label: 'Shop Analytics',description: 'Analyze any Etsy shop',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'tags',        label: 'Tag Optimizer', description: 'Find best-performing tags',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
]

function TabContent({ active }: { active: TabId }) {
  const map: Record<TabId, React.ReactNode> = {
    keywords:    <KeywordsTab />,
    listings:    <ListingsTab />,
    competitors: <CompetitorsTab />,
    trends:      <TrendsTab />,
    shop:        <ShopTab />,
    tags:        <TagOptimizerTab />,
  }
  return (
    <Suspense fallback={<div className="shimmer" style={{ height: 300, borderRadius: 12, background: '#ddd' }} />}>
      {map[active]}
    </Suspense>
  )
}

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('keywords')
  const { data: user } = useAuth()
  const logout = useLogout()
  const handleTab = useCallback((id: TabId) => setActiveTab(id), [])

  const activeInfo = TABS.find(t => t.id === activeTab)!

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.warmGray }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{ width: 220, background: C.snow, borderRight: '1px solid rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22V12M12 12C12 7 7 4 2 5c0 5 3 9 10 7M12 12c0-5 5-8 10-7 0 5-3 9-10 7"/>
            </svg>
            <span style={{ fontWeight: 600, fontSize: 16, color: C.forest, letterSpacing: '-0.4px' }}>Ranksty</span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono',monospace", color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 10px', marginBottom: 4 }}>Tools</p>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 10px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left', width: '100%', transition: 'background 0.15s',
                background: activeTab === tab.id ? C.forest : 'transparent',
                color:      activeTab === tab.id ? C.snow : '#555',
              }}>
              <span style={{ display: 'flex', flexShrink: 0, opacity: activeTab === tab.id ? 1 : 0.7 }}>{tab.icon}</span>
              <span style={{ fontSize: 13, fontWeight: activeTab === tab.id ? 500 : 400 }}>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* User section */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {user && (
            <div style={{ padding: '10px', borderRadius: 10, background: C.warmGray, marginBottom: 8 }}>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: C.forest, marginBottom: 1 }}>{user.name}</p>
              <p style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{user.email}</p>
              <span style={{ fontSize: 10, background: C.pale, color: C.forest, padding: '2px 8px', borderRadius: 999, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, textTransform: 'uppercase' }}>
                {user.plan}
              </span>
            </div>
          )}
          <button onClick={() => logout.mutate()}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#999', fontSize: 12.5, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.warmGray)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ padding: '16px 28px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: C.snow, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 500, color: C.forest, letterSpacing: '-0.3px', marginBottom: 2 }}>{activeInfo.label}</h1>
            <p style={{ fontSize: 12, color: '#999' }}>{activeInfo.description}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, background: C.pale, color: C.forest, padding: '4px 12px', borderRadius: 999, fontFamily: "'IBM Plex Mono',monospace" }}>Etsy API · Live</span>
            {user && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.forest, color: C.snow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px 28px', overflowY: 'auto' }}>
          <TabContent active={activeTab} />
        </div>
      </main>
    </div>
  )
}
