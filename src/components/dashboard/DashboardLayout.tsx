'use client'
import { useState, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { C } from '@/utils'

const KeywordsTab      = dynamic(() => import('./tabs/KeywordsTab').then(m => ({ default: m.KeywordsTab })), { ssr: false })
const ListingsTab      = dynamic(() => import('./tabs/ListingsTab').then(m => ({ default: m.ListingsTab })), { ssr: false })
const CompetitorsTab   = dynamic(() => import('./tabs/CompetitorsTab').then(m => ({ default: m.CompetitorsTab })), { ssr: false })
const TrendsTab        = dynamic(() => import('./tabs/TrendsTab').then(m => ({ default: m.TrendsTab })), { ssr: false })
const ShopTab          = dynamic(() => import('./tabs/ShopTab').then(m => ({ default: m.ShopTab })), { ssr: false })
const TagOptimizerTab  = dynamic(() => import('./tabs/TagOptimizerTab').then(m => ({ default: m.TagOptimizerTab })), { ssr: false })
const FeeCalculatorTab = dynamic(() => import('./tabs/FeeCalculatorTab').then(m => ({ default: m.FeeCalculatorTab })), { ssr: false })
const ListingAuditTab      = dynamic(() => import('./tabs/ListingAuditTab').then(m => ({ default: m.ListingAuditTab })), { ssr: false })
const TagTitleGeneratorTab = dynamic(() => import('./tabs/TagTitleGeneratorTab').then(m => ({ default: m.TagTitleGeneratorTab })), { ssr: false })
const KeywordListsTab      = dynamic(() => import('./tabs/KeywordListsTab').then(m => ({ default: m.KeywordListsTab })), { ssr: false })
const BulkKeywordTab       = dynamic(() => import('./tabs/BulkKeywordTab').then(m => ({ default: m.BulkKeywordTab })), { ssr: false })

type TabId = 'keywords' | 'listings' | 'competitors' | 'trends' | 'bulk' | 'shop' | 'tags' | 'generator' | 'audit' | 'fees' | 'lists'

const ICON = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>

const TABS: { id: TabId; label: string; icon: React.ReactNode; description: string; group: string }[] = [
  { id: 'keywords',    label: 'Keywords',      group: 'Research',    description: 'Research search volume & CTR',
    icon: ICON(<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>) },
  { id: 'listings',    label: 'Listings',      group: 'Research',    description: 'Browse live Etsy listings',
    icon: ICON(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>) },
  { id: 'competitors', label: 'Competitors',   group: 'Research',    description: 'Analyze top sellers',
    icon: ICON(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>) },
  { id: 'trends',      label: 'Trends',        group: 'Research',    description: 'Track search trends',
    icon: ICON(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>) },
  { id: 'bulk',        label: 'Bulk Keywords', group: 'Research',    description: 'Compare keywords in bulk',
    icon: ICON(<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>) },
  { id: 'shop',        label: 'Shop Analytics',group: 'Optimize',    description: 'Analyze any Etsy shop',
    icon: ICON(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>) },
  { id: 'tags',        label: 'Tag Optimizer', group: 'Optimize',    description: 'Find best-performing tags',
    icon: ICON(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>) },
  { id: 'generator',   label: 'Tag & Title Gen',group: 'Optimize',   description: 'Generate tags & titles',
    icon: ICON(<><path d="M9.5 3l1.4 3.6L14.5 8l-3.6 1.4L9.5 13 8.1 9.4 4.5 8l3.6-1.4z"/><path d="M18 13l.9 2.1 2.1.9-2.1.9L18 19l-.9-2.1-2.1-.9 2.1-.9z"/></>) },
  { id: 'audit',       label: 'Listing Audit', group: 'Optimize',    description: 'Score a listing\'s SEO',
    icon: ICON(<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>) },
  { id: 'fees',        label: 'Fee Calculator',group: 'Tools',       description: 'Estimate Etsy fees & profit',
    icon: ICON(<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/></>) },
  { id: 'lists',       label: 'Keyword Lists', group: 'Tools',       description: 'Save & organize keywords',
    icon: ICON(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>) },
]

const GROUPS = ['Research', 'Optimize', 'Tools']

function TabContent({ active }: { active: TabId }) {
  const map: Record<TabId, React.ReactNode> = {
    keywords:    <KeywordsTab />,
    listings:    <ListingsTab />,
    competitors: <CompetitorsTab />,
    trends:      <TrendsTab />,
    bulk:        <BulkKeywordTab />,
    shop:        <ShopTab />,
    tags:        <TagOptimizerTab />,
    generator:   <TagTitleGeneratorTab />,
    audit:       <ListingAuditTab />,
    fees:        <FeeCalculatorTab />,
    lists:       <KeywordListsTab />,
  }
  return (
    <Suspense fallback={<div className="shimmer" style={{ height: 300, borderRadius: 8, background: '#e8e7e2' }} />}>
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
    <div style={{ display: 'flex', minHeight: '100vh', background: C.canvas }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{ width: 224, background: C.paper, borderRight: `1px solid ${C.hair}`, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${C.hair}` }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/website_logo.png" alt="Ranktsy" style={{ width: 122, height: 40, objectFit: 'contain', display: 'block' }} />
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {GROUPS.map(group => (
            <div key={group} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 9.5, fontFamily: "'IBM Plex Mono',monospace", color: '#b7b7b0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 10px', marginBottom: 4 }}>{group}</p>
              {TABS.filter(t => t.group === group).map(tab => {
                const active = activeTab === tab.id
                return (
                  <button key={tab.id} onClick={() => handleTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 11px', borderRadius: 8, border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                      transition: 'background 0.15s, color 0.15s',
                      background: active ? C.orange : 'transparent',
                      color: active ? '#fff' : C.inkSoft,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.canvas }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                    <span style={{ display: 'flex', flexShrink: 0, opacity: active ? 1 : 0.65 }}>{tab.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 450 }}>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User section */}
        <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.hair}` }}>
          {user && (
            <div style={{ padding: '11px', borderRadius: 10, background: C.canvas, marginBottom: 8 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: C.charcoal, marginBottom: 1 }}>{user.name ?? 'User'}</p>
              <p style={{ fontSize: 11, color: '#8f8f88', marginBottom: 7 }}>{user.email ?? ''}</p>
              <span style={{ fontSize: 10, background: C.orange, color: '#fff', padding: '2px 9px', borderRadius: 999, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, textTransform: 'uppercase' }}>
                {user.plan ?? 'free'}
              </span>
              {user.role === 'admin' && (
                <span style={{ fontSize: 10, background: C.successBg, color: C.success, padding: '2px 9px', borderRadius: 999, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, textTransform: 'uppercase', marginLeft: 6 }}>admin</span>
              )}
            </div>
          )}
          <Link href="/profile"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 8, textDecoration: 'none', cursor: 'pointer', color: C.inkSoft, fontSize: 12.5, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profile
          </Link>
          {user?.role === 'admin' && (
            <Link href="/admin"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 8, textDecoration: 'none', cursor: 'pointer', color: C.inkSoft, fontSize: 12.5, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Admin
            </Link>
          )}
          <button onClick={() => logout.mutate()}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#9a9a92', fontSize: 12.5, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ padding: '15px 28px', borderBottom: `1px solid ${C.hair}`, background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 5 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 400, color: C.ink, letterSpacing: '-0.5px', marginBottom: 2 }}>{activeInfo.label}</h1>
            <p style={{ fontSize: 12, color: '#9a9a92' }}>{activeInfo.description}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, background: C.orangeFaint, color: C.orange, padding: '5px 12px', borderRadius: 999, fontFamily: "'IBM Plex Mono',monospace", border: `1px solid rgba(255,96,8,0.20)` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              Etsy API · Live
            </span>
            {user && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                {user.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '22px 28px', overflowY: 'auto' }}>
          <TabContent active={activeTab} />
        </div>

        {/* Etsy API attribution — required by Etsy API Terms of Use (Section 6) */}
        <div style={{ padding: '12px 28px', borderTop: `1px solid ${C.hair}`, background: C.paper, flexShrink: 0 }}>
          <p style={{ fontSize: 11.5, color: '#8a8a82', fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.5, margin: 0 }}>
            The term &apos;Etsy&apos; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
          </p>
        </div>
      </main>
    </div>
  )
}
