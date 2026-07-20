'use client'
import { useState, useCallback, useEffect, Suspense } from 'react'
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
const RankCheckerTab       = dynamic(() => import('./tabs/RankCheckerTab').then(m => ({ default: m.RankCheckerTab })), { ssr: false })
const AdsRoiCalculatorTab  = dynamic(() => import('./tabs/AdsRoiCalculatorTab').then(m => ({ default: m.AdsRoiCalculatorTab })), { ssr: false })
const CompetitorTagsTab    = dynamic(() => import('./tabs/CompetitorTagsTab').then(m => ({ default: m.CompetitorTagsTab })), { ssr: false })
const CompareListingsTab   = dynamic(() => import('./tabs/CompareListingsTab').then(m => ({ default: m.CompareListingsTab })), { ssr: false })
const SpellCheckerTab      = dynamic(() => import('./tabs/SpellCheckerTab').then(m => ({ default: m.SpellCheckerTab })), { ssr: false })
const CategoryToolTab      = dynamic(() => import('./tabs/CategoryToolTab').then(m => ({ default: m.CategoryToolTab })), { ssr: false })
const CalendarTab          = dynamic(() => import('./tabs/CalendarTab').then(m => ({ default: m.CalendarTab })), { ssr: false })
const TrendBuzzTab         = dynamic(() => import('./tabs/TrendBuzzTab').then(m => ({ default: m.TrendBuzzTab })), { ssr: false })
const MonthlyTrendsTab     = dynamic(() => import('./tabs/MonthlyTrendsTab').then(m => ({ default: m.MonthlyTrendsTab })), { ssr: false })
const TopSellersTab        = dynamic(() => import('./tabs/TopSellersTab').then(m => ({ default: m.TopSellersTab })), { ssr: false })
const OverviewTab          = dynamic(() => import('./tabs/OverviewTab').then(m => ({ default: m.OverviewTab })), { ssr: false })
const CategoryReportTab    = dynamic(() => import('./tabs/CategoryReportTab').then(m => ({ default: m.CategoryReportTab })), { ssr: false })
const AIListingHelperTab   = dynamic(() => import('./tabs/AIListingHelperTab').then(m => ({ default: m.AIListingHelperTab })), { ssr: false })
const MyShopTab            = dynamic(() => import('./tabs/MyShopTab').then(m => ({ default: m.MyShopTab })), { ssr: false })
const CompetitorSalesTab   = dynamic(() => import('./tabs/CompetitorSalesTab').then(m => ({ default: m.CompetitorSalesTab })), { ssr: false })
const SalesMapTab          = dynamic(() => import('./tabs/SalesMapTab').then(m => ({ default: m.SalesMapTab })), { ssr: false })
const DeliveryStatusTab    = dynamic(() => import('./tabs/DeliveryStatusTab').then(m => ({ default: m.DeliveryStatusTab })), { ssr: false })
const KeywordGapTab        = dynamic(() => import('./tabs/KeywordGapTab').then(m => ({ default: m.KeywordGapTab })), { ssr: false })

type TabId = 'overview' | 'myshop' | 'keywords' | 'gap' | 'listings' | 'competitors' | 'compsales' | 'trends' | 'buzz' | 'monthly' | 'topsellers' | 'catreport' | 'bulk' | 'rank' | 'shop' | 'salesmap' | 'delivery' | 'tags' | 'aihelper' | 'ctags' | 'generator' | 'audit' | 'compare' | 'spell' | 'fees' | 'adsroi' | 'category' | 'calendar' | 'lists'

const ICON = (d: React.ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>

const TABS: { id: TabId; label: string; icon: React.ReactNode; description: string; group: string }[] = [
  { id: 'overview',    label: 'Overview',      group: 'Home',        description: 'Your Etsy SEO command center',
    icon: ICON(<><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>) },
  { id: 'myshop',      label: 'My Shop',       group: 'Home',        description: 'Your connected shop\'s sales & insights',
    icon: ICON(<><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 21v-6h6v6"/></>) },
  { id: 'keywords',    label: 'Keywords',      group: 'Research',    description: 'Research search volume & CTR',
    icon: ICON(<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>) },
  { id: 'listings',    label: 'Listings',      group: 'Research',    description: 'Browse live Etsy listings',
    icon: ICON(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>) },
  { id: 'competitors', label: 'Competitors',   group: 'Research',    description: 'Analyze top sellers',
    icon: ICON(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>) },
  { id: 'trends',      label: 'Trends',        group: 'Research',    description: 'Track search trends',
    icon: ICON(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>) },
  { id: 'buzz',        label: 'Trend Buzz',    group: 'Research',    description: 'Emerging keywords heating up on Etsy',
    icon: ICON(<><path d="M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z"/><line x1="9" y1="22" x2="15" y2="22"/></>) },
  { id: 'monthly',     label: 'Monthly Trends',group: 'Research',    description: 'Seasonal, month-by-month demand',
    icon: ICON(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14l2 2 4-4"/></>) },
  { id: 'topsellers',  label: 'Top Sellers',   group: 'Research',    description: 'Leading shops in any niche',
    icon: ICON(<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></>) },
  { id: 'catreport',   label: 'Category Report',group: 'Research',    description: 'Market snapshot for a niche',
    icon: ICON(<><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/></>) },
  { id: 'compsales',   label: 'Competitor Sales',group: 'Research',  description: 'Real sales & daily velocity',
    icon: ICON(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>) },
  { id: 'gap',         label: 'Keyword Gap',   group: 'Research',    description: 'Find the hidden keywords you\'re missing',
    icon: ICON(<><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>) },
  { id: 'bulk',        label: 'Bulk Keywords', group: 'Research',    description: 'Compare keywords in bulk',
    icon: ICON(<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>) },
  { id: 'rank',        label: 'Rank Checker',  group: 'Research',    description: 'Find where your shop ranks',
    icon: ICON(<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>) },
  { id: 'shop',        label: 'Shop Analytics',group: 'Optimize',    description: 'Analyze any Etsy shop',
    icon: ICON(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>) },
  // Own-shop tools — these read your Etsy receipts over OAuth, which is the only
  // place Etsy exposes buyer country and fulfilment state.
  { id: 'salesmap',    label: 'Sales Map',     group: 'Shop Insights', description: 'Where your buyers are',
    icon: ICON(<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>) },
  { id: 'delivery',    label: 'Delivery Status',group: 'Shop Insights', description: 'Orders awaiting shipment',
    icon: ICON(<><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>) },
  { id: 'tags',        label: 'Tag Optimizer', group: 'Optimize',    description: 'Find best-performing tags',
    icon: ICON(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>) },
  { id: 'generator',   label: 'Tag & Title Gen',group: 'Optimize',   description: 'Generate tags & titles',
    icon: ICON(<><path d="M9.5 3l1.4 3.6L14.5 8l-3.6 1.4L9.5 13 8.1 9.4 4.5 8l3.6-1.4z"/><path d="M18 13l.9 2.1 2.1.9-2.1.9L18 19l-.9-2.1-2.1-.9 2.1-.9z"/></>) },
  { id: 'aihelper',    label: 'AI Listing Helper',group: 'Optimize', description: 'AI title, tags & description',
    icon: ICON(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.2"/></>) },
  { id: 'audit',       label: 'Listing Audit', group: 'Optimize',    description: 'Score a listing\'s SEO',
    icon: ICON(<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>) },
  { id: 'ctags',       label: 'Competitor Tags',group: 'Optimize',   description: 'Extract a shop\'s tags',
    icon: ICON(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>) },
  { id: 'compare',     label: 'Compare Listings',group: 'Optimize',  description: 'Two listings side by side',
    icon: ICON(<><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></>) },
  { id: 'spell',       label: 'Spell Checker', group: 'Optimize',    description: 'Catch tag typos',
    icon: ICON(<><path d="M2 6h13"/><path d="M2 12h9"/><path d="M2 18h6"/><path d="m15 16 2 2 5-5"/></>) },
  { id: 'fees',        label: 'Fee Calculator',group: 'Tools',       description: 'Estimate Etsy fees & profit',
    icon: ICON(<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/></>) },
  { id: 'adsroi',      label: 'Ads ROI',       group: 'Tools',       description: 'Etsy Ads ROI & CPC calculator',
    icon: ICON(<><path d="M3 3v18h18"/><path d="M7 15l3-3 3 3 5-6"/></>) },
  { id: 'category',    label: 'Category Finder',group: 'Tools',      description: 'Browse Etsy categories',
    icon: ICON(<><path d="M4 4h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/></>) },
  { id: 'calendar',    label: 'Seasonal Calendar',group: 'Tools',   description: 'Plan for selling events',
    icon: ICON(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>) },
  { id: 'lists',       label: 'Keyword Lists', group: 'Tools',       description: 'Save & organize keywords',
    icon: ICON(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>) },
]

const GROUPS = ['Home', 'Research', 'Shop Insights', 'Optimize', 'Tools']

function TabContent({ active, onNavigate }: { active: TabId; onNavigate: (id: TabId) => void }) {
  const map: Record<TabId, React.ReactNode> = {
    overview:    <OverviewTab onNavigate={(id) => onNavigate(id as TabId)} />,
    myshop:      <MyShopTab />,
    keywords:    <KeywordsTab onNavigate={(id) => onNavigate(id as TabId)} />,
    gap:         <KeywordGapTab />,
    listings:    <ListingsTab />,
    competitors: <CompetitorsTab />,
    compsales:   <CompetitorSalesTab />,
    salesmap:    <SalesMapTab />,
    delivery:    <DeliveryStatusTab />,
    trends:      <TrendsTab />,
    buzz:        <TrendBuzzTab />,
    monthly:     <MonthlyTrendsTab />,
    topsellers:  <TopSellersTab />,
    catreport:   <CategoryReportTab />,
    aihelper:    <AIListingHelperTab />,
    bulk:        <BulkKeywordTab />,
    rank:        <RankCheckerTab />,
    shop:        <ShopTab />,
    tags:        <TagOptimizerTab />,
    ctags:       <CompetitorTagsTab />,
    generator:   <TagTitleGeneratorTab />,
    audit:       <ListingAuditTab />,
    compare:     <CompareListingsTab />,
    spell:       <SpellCheckerTab />,
    fees:        <FeeCalculatorTab />,
    adsroi:      <AdsRoiCalculatorTab />,
    category:    <CategoryToolTab />,
    calendar:    <CalendarTab />,
    lists:       <KeywordListsTab />,
  }
  return (
    <Suspense fallback={<div className="shimmer" style={{ height: 300, borderRadius: 8, background: '#e8e7e2' }} />}>
      {map[active]}
    </Suspense>
  )
}

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [navOpen, setNavOpen] = useState(false)
  const { data: user } = useAuth()
  const logout = useLogout()
  const handleTab = useCallback((id: TabId) => { setActiveTab(id); setNavOpen(false) }, [])

  // After the Etsy OAuth redirect (…/dashboard?etsy=connected), land on My Shop
  // and clean the URL so a refresh doesn't re-trigger the banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('etsy')) {
      setActiveTab('myshop')
      params.delete('etsy')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  const activeInfo = TABS.find(t => t.id === activeTab)!

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.canvas }}>

      {/* Backdrop for the mobile drawer (only visible ≤900px) */}
      <div className={`rdash-overlay${navOpen ? ' rdash-open' : ''}`} onClick={() => setNavOpen(false)} aria-hidden />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className={`rdash-aside${navOpen ? ' rdash-open' : ''}`} style={{ width: 244, background: C.paper, borderRight: `1px solid ${C.ash}`, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${C.ash}` }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/website_logo.png" alt="Rankkw" style={{ width: 128, height: 42, objectFit: 'contain', display: 'block' }} />
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {GROUPS.map(group => (
            <div key={group} style={{ marginBottom: 14 }}>
              <p className="rlabel" style={{ fontSize: 10.5, fontFamily: "'General Sans',sans-serif", fontWeight: 600, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 12px', marginBottom: 6 }}>{group}</p>
              {TABS.filter(t => t.group === group).map(tab => {
                const active = activeTab === tab.id
                return (
                  <button key={tab.id} onClick={() => handleTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13,
                      padding: '11px 14px', borderRadius: 11, border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                      transition: 'background 0.15s, color 0.15s',
                      background: active ? C.orange : 'transparent',
                      color: active ? '#fff' : C.inkSoft,
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.canvas; e.currentTarget.style.color = C.ink } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.inkSoft } }}>
                    <span style={{ display: 'flex', flexShrink: 0, opacity: active ? 1 : 0.72 }}>{tab.icon}</span>
                    <span className="rlabel" style={{ fontSize: 14.5, fontWeight: active ? 500 : 450 }}>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User section */}
        <div style={{ padding: '14px 12px', borderTop: `1px solid ${C.ash}` }}>
          {user && (
            <div className="rdash-usercard" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px', borderRadius: 12, background: C.canvas, marginBottom: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: '50%', background: C.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, flexShrink: 0 }}>
                {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name ?? 'User'}</p>
                <span style={{ fontSize: 10.5, background: C.orange, color: '#fff', padding: '2px 8px', borderRadius: 999, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {user.plan ?? 'free'}
                </span>
                {user.role === 'admin' && (
                  <span style={{ fontSize: 10.5, background: 'rgba(61,62,59,0.1)', color: C.ink, padding: '2px 8px', borderRadius: 999, fontWeight: 600, textTransform: 'uppercase', marginLeft: 5 }}>admin</span>
                )}
              </div>
            </div>
          )}
          <Link href="/profile"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 10, textDecoration: 'none', cursor: 'pointer', color: C.inkSoft, fontSize: 14, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="rlabel">Profile</span>
          </Link>
          {user?.role === 'admin' && (
            <Link href="/admin"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 10, textDecoration: 'none', cursor: 'pointer', color: C.inkSoft, fontSize: 14, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span className="rlabel">Admin</span>
            </Link>
          )}
          <button onClick={() => logout.mutate()}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: C.graphite, fontSize: 14, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span className="rlabel">Log out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div className="rdash-topbar" style={{ padding: '15px 28px', borderBottom: `1px solid ${C.hair}`, background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            {/* Mobile drawer toggle — hidden on desktop via CSS */}
            <button className="rdash-burger" onClick={() => setNavOpen(o => !o)} aria-label="Toggle menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 23, fontWeight: 500, color: C.ink, letterSpacing: '-0.03em', marginBottom: 3 }}>{activeInfo.label}</h1>
              <p className="rdash-desc" style={{ fontSize: 14, color: C.graphite }}>{activeInfo.description}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span className="rdash-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, background: C.orangeFaint, color: C.orange, padding: '5px 12px', borderRadius: 999, fontFamily: "'General Sans',monospace", border: `1px solid rgba(251,94,9,0.20)` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              Etsy API · Live
            </span>
            {user && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500 }}>
                {user.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="rdash-content" style={{ flex: 1, padding: '22px 28px', overflowY: 'auto' }}>
          <TabContent active={activeTab} onNavigate={handleTab} />
        </div>

        {/* Etsy API attribution — required by Etsy API Terms of Use (Section 6) */}
        <div className="rdash-footer" style={{ padding: '12px 28px', borderTop: `1px solid ${C.hair}`, background: C.paper, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 11.5, color: '#8a8a82', fontFamily: "'General Sans',monospace", lineHeight: 1.5, margin: 0 }}>
            The term &apos;Etsy&apos; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
          </p>
          <Link href="/methodology" style={{ fontSize: 11.5, color: C.orange, fontFamily: "'General Sans',monospace", textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>How our data works →</Link>
        </div>
      </main>
    </div>
  )
}
