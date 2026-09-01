'use client'
import { Icon } from '@/components/ui/Icon'
import { useState, useCallback, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { useCredits } from '@/hooks/useCredits'
import { C, ACCENT, withAlpha, formatNumber, type AccentName } from '@/utils'
import { UpgradeModalHost } from './UpgradeModal'
import { triggerUpgrade } from '@/lib/upgrade'
import { AnimIcon, DASH_ICON } from '@/components/ui/AnimIcon'
import { NavButton } from '@/components/ui/NavButton'
import { DashboardLoader } from './DashboardLoader'
import { DashboardTour } from './DashboardTour'
import { RealtimeProvider, NotificationBell, ChatWidget } from './Realtime'
import { OnboardingChecklist } from './OnboardingChecklist'

const KeywordsTab      = dynamic(() => import('./tabs/KeywordsTab').then(m => ({ default: m.KeywordsTab })), { ssr: false })
const ListingsTab      = dynamic(() => import('./tabs/ListingsTab').then(m => ({ default: m.ListingsTab })), { ssr: false })
const CompetitorsTab   = dynamic(() => import('./tabs/CompetitorsTab').then(m => ({ default: m.CompetitorsTab })), { ssr: false })
const TrendsTab        = dynamic(() => import('./tabs/TrendsTab').then(m => ({ default: m.TrendsTab })), { ssr: false })
const ShopTab          = dynamic(() => import('./tabs/ShopTab').then(m => ({ default: m.ShopTab })), { ssr: false })
const TagOptimizerTab  = dynamic(() => import('./tabs/TagOptimizerTab').then(m => ({ default: m.TagOptimizerTab })), { ssr: false })
const FeeCalculatorTab = dynamic(() => import('./tabs/FeeCalculatorTab').then(m => ({ default: m.FeeCalculatorTab })), { ssr: false })
const ListingAuditTab      = dynamic(() => import('./tabs/ListingAuditTab').then(m => ({ default: m.ListingAuditTab })), { ssr: false })
const TitleGenTab       = dynamic(() => import('./tabs/TitleGenTab').then(m => ({ default: m.TitleGenTab })), { ssr: false })
const TagGenTab         = dynamic(() => import('./tabs/TagGenTab').then(m => ({ default: m.TagGenTab })), { ssr: false })
const DescriptionGenTab = dynamic(() => import('./tabs/DescriptionGenTab').then(m => ({ default: m.DescriptionGenTab })), { ssr: false })
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
const EtsyListingProTab    = dynamic(() => import('./tabs/EtsyListingProTab').then(m => ({ default: m.EtsyListingProTab })), { ssr: false })
const MyShopTab            = dynamic(() => import('./tabs/MyShopTab').then(m => ({ default: m.MyShopTab })), { ssr: false })
const CompetitorSalesTab   = dynamic(() => import('./tabs/CompetitorSalesTab').then(m => ({ default: m.CompetitorSalesTab })), { ssr: false })
const SalesMapTab          = dynamic(() => import('./tabs/SalesMapTab').then(m => ({ default: m.SalesMapTab })), { ssr: false })
const DeliveryStatusTab    = dynamic(() => import('./tabs/DeliveryStatusTab').then(m => ({ default: m.DeliveryStatusTab })), { ssr: false })
const KeywordGapTab        = dynamic(() => import('./tabs/KeywordGapTab').then(m => ({ default: m.KeywordGapTab })), { ssr: false })
const HotProductsTab       = dynamic(() => import('./tabs/HotProductsTab').then(m => ({ default: m.HotProductsTab })), { ssr: false })
const AlertsTab            = dynamic(() => import('./tabs/AlertsTab').then(m => ({ default: m.AlertsTab })), { ssr: false })

type TabId = 'overview' | 'myshop' | 'hotproducts' | 'keywords' | 'gap' | 'listings' | 'competitors' | 'compsales' | 'trends' | 'buzz' | 'monthly' | 'topsellers' | 'catreport' | 'bulk' | 'rank' | 'shop' | 'salesmap' | 'delivery' | 'tags' | 'aihelper' | 'listingpro' | 'ctags' | 'titlegen' | 'taggen' | 'descgen' | 'audit' | 'compare' | 'spell' | 'fees' | 'adsroi' | 'category' | 'calendar' | 'lists' | 'alerts'

const TABS: { id: TabId; label: string; description: string; group: string; accent: AccentName }[] = [
  { id: 'overview',    label: 'Overview',      group: 'Home',        accent: 'indigo',  description: 'Your Etsy SEO command center' },
  { id: 'myshop',      label: 'My Shop',       group: 'Home',        accent: 'orange',  description: 'Your connected shop\'s sales & insights' },
  { id: 'hotproducts', label: 'Find Hot Products',group: 'Research', accent: 'rose',    description: 'Discover trending products by real engagement' },
  { id: 'keywords',    label: 'Keywords',      group: 'Research',    accent: 'blue',    description: 'Research search volume & CTR' },
  { id: 'listings',    label: 'Listings',      group: 'Research',    accent: 'cyan',    description: 'Browse live listings' },
  { id: 'competitors', label: 'Competitors',   group: 'Research',    accent: 'violet',  description: 'Analyze top sellers' },
  { id: 'trends',      label: 'Trends',        group: 'Research',    accent: 'teal',    description: 'Track search trends' },
  { id: 'buzz',        label: 'Trend Buzz',    group: 'Research',    accent: 'rose',    description: 'Emerging keywords heating up on Etsy' },
  { id: 'monthly',     label: 'Monthly Trends',group: 'Research',    accent: 'sky',     description: 'Seasonal, month-by-month demand' },
  { id: 'topsellers',  label: 'Top Sellers',   group: 'Research',    accent: 'amber',   description: 'Leading shops in any niche' },
  { id: 'catreport',   label: 'Category Report',group: 'Research',   accent: 'emerald', description: 'Market snapshot for a niche' },
  { id: 'compsales',   label: 'Competitor Sales',group: 'Research',  accent: 'green',   description: 'Real sales & daily velocity' },
  { id: 'gap',         label: 'Keyword Gap',   group: 'Research',    accent: 'fuchsia', description: 'Find the hidden keywords you\'re missing' },
  { id: 'bulk',        label: 'Bulk Keywords', group: 'Research',    accent: 'purple',  description: 'Compare keywords in bulk' },
  { id: 'rank',        label: 'Rank Checker',  group: 'Research',    accent: 'red',     description: 'Find where your shop ranks' },
  { id: 'alerts',      label: 'Alerts',        group: 'Research',    accent: 'amber',   description: 'Get notified when keywords change' },
  { id: 'shop',        label: 'Shop Analytics',group: 'Optimize',    accent: 'violet',  description: 'Analyze any Etsy shop' },
  // Own-shop tools - these read your Etsy receipts over OAuth, which is the only
  // place Etsy exposes buyer country and fulfilment state.
  { id: 'salesmap',    label: 'Sales Map',     group: 'Shop Insights', accent: 'pink',  description: 'Where your buyers are' },
  { id: 'delivery',    label: 'Delivery Status',group: 'Shop Insights', accent: 'cyan', description: 'Orders awaiting shipment' },
  { id: 'tags',        label: 'Tag Optimizer', group: 'Optimize',    accent: 'emerald', description: 'Find best-performing tags' },
  { id: 'titlegen',    label: 'Title Generator',group: 'Optimize',   accent: 'amber',   description: 'AI Etsy titles from real data' },
  { id: 'taggen',      label: 'Tag Generator', group: 'Optimize',    accent: 'amber',   description: 'AI Etsy tags from real data' },
  { id: 'descgen',     label: 'Description Gen',group: 'Optimize',    accent: 'amber',   description: 'AI Etsy descriptions from real data' },
  { id: 'listingpro',  label: 'Etsy Listing Pro', group: 'Optimize', accent: 'rose',    description: 'A whole listing + AI images in one click' },
  { id: 'aihelper',    label: 'AI Listing Helper',group: 'Optimize', accent: 'fuchsia', description: 'AI title, tags & description' },
  { id: 'audit',       label: 'Listing Audit', group: 'Optimize',    accent: 'green',   description: 'Score a listing\'s SEO' },
  { id: 'ctags',       label: 'Competitor Tags',group: 'Optimize',   accent: 'teal',    description: 'Extract a shop\'s tags' },
  { id: 'compare',     label: 'Compare Listings',group: 'Optimize',  accent: 'blue',    description: 'Two listings side by side' },
  { id: 'spell',       label: 'Spell Checker', group: 'Optimize',    accent: 'red',     description: 'Catch tag typos' },
  { id: 'fees',        label: 'Fee Calculator',group: 'Tools',       accent: 'green',   description: 'Estimate Etsy fees & profit' },
  { id: 'adsroi',      label: 'Ads ROI',       group: 'Tools',       accent: 'amber',   description: 'Etsy Ads ROI & CPC calculator' },
  { id: 'category',    label: 'Category Finder',group: 'Tools',      accent: 'sky',     description: 'Browse Etsy categories' },
  { id: 'calendar',    label: 'Seasonal Calendar',group: 'Tools',   accent: 'purple',  description: 'Plan for selling events' },
  { id: 'lists',       label: 'Keyword Lists', group: 'Tools',       accent: 'slate',   description: 'Save & organize keywords' },
]

const GROUPS = ['Home', 'Research', 'Shop Insights', 'Optimize', 'Tools']

function TabContent({ active, onNavigate }: { active: TabId; onNavigate: (id: TabId) => void }) {
  const map: Record<TabId, React.ReactNode> = {
    overview:    <OverviewTab onNavigate={(id) => onNavigate(id as TabId)} />,
    myshop:      <MyShopTab />,
    hotproducts: <HotProductsTab onNavigate={(id) => onNavigate(id as TabId)} />,
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
    listingpro:  <EtsyListingProTab />,
    bulk:        <BulkKeywordTab />,
    rank:        <RankCheckerTab />,
    shop:        <ShopTab />,
    tags:        <TagOptimizerTab />,
    ctags:       <CompetitorTagsTab />,
    titlegen:    <TitleGenTab />,
    taggen:      <TagGenTab />,
    descgen:     <DescriptionGenTab />,
    audit:       <ListingAuditTab />,
    compare:     <CompareListingsTab />,
    spell:       <SpellCheckerTab />,
    fees:        <FeeCalculatorTab />,
    adsroi:      <AdsRoiCalculatorTab />,
    category:    <CategoryToolTab />,
    calendar:    <CalendarTab />,
    lists:       <KeywordListsTab />,
    alerts:      <AlertsTab />,
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
  // Filter the sidebar so a user can find a tool by typing part of its name.
  const [navFilter, setNavFilter] = useState('')
  // Brand splash: plays the "Rankkw" draw-on once when the dashboard first mounts.
  const [booting, setBooting] = useState(true)
  const { data: user } = useAuth()
  const logout = useLogout()
  // Daily credit balance for the "other tools" - live-updated after each use.
  const credits = useCredits()
  // Current plan, read fresh from the DB (not the possibly-stale JWT).
  const [planInfo, setPlanInfo] = useState<{ plan: string; label: string } | null>(null)
  useEffect(() => {
    fetch('/api/plan').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.success) setPlanInfo({ plan: d.plan, label: d.label }) }).catch(() => {})
  }, [])
  const handleTab = useCallback((id: TabId) => { setActiveTab(id); setNavOpen(false) }, [])

  // Deep links: the Etsy OAuth redirect (…/dashboard?etsy=connected) lands on My
  // Shop; the marketing nav opens a specific tool via …/dashboard?tab=<id>. Either
  // way the query is cleaned so a refresh doesn't re-trigger it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    let target: TabId | null = null
    if (params.has('etsy')) { target = 'myshop'; params.delete('etsy') }
    const tab = params.get('tab')
    if (tab && TABS.some(t => t.id === tab)) { target = tab as TabId; params.delete('tab') }
    if (target) {
      // Deliberate one-time deep-link handling on mount (runs once, empty deps).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(target)
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  const activeInfo = TABS.find(t => t.id === activeTab)!
  const activeHue = ACCENT[activeInfo.accent]

  // Brand splash: render ONLY the loader first (nothing else on the main thread),
  // so the draw-on animation is smooth; the dashboard mounts once it finishes. The
  // loader itself no-ops instantly if it already played this session.
  if (booting) return <DashboardLoader onDone={() => setBooting(false)} />

  // Checked fresh from the DB on every /auth/me call (never cached in the
  // JWT) - an admin restricting this account blocks it starting now, not
  // after the access token expires.
  if (user?.restricted) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: C.canvas, padding: 24 }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><Icon name="lock" size={40} color={C.stone} /></div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: C.ink, marginBottom: 10, letterSpacing: '-0.02em' }}>Access restricted</h1>
          <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.65, marginBottom: 24 }}>
            You are unable to access the dashboard because your account has been restricted by an administrator. If you believe this is a mistake, please contact support.
          </p>
          <button onClick={() => logout.mutate()} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 100, padding: '11px 26px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Log out
          </button>
        </div>
      </div>
    )
  }

  return (
    <RealtimeProvider isAdmin={user?.role === 'admin'}>
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
        <nav data-tour="nav" style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Tool filter - type part of a tool's name to jump to it */}
          <div style={{ padding: '0 2px 12px' }}>
            <div data-tour="tool-search" style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '8px 11px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={navFilter} onChange={e => setNavFilter(e.target.value)} placeholder="Find a tool..." aria-label="Find a tool"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5, fontFamily: 'inherit', color: C.ink }} />
              {navFilter && (
                <button onClick={() => setNavFilter('')} aria-label="Clear filter" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.stone, display: 'flex', padding: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
          </div>
          {GROUPS.map(group => {
            const fq = navFilter.trim().toLowerCase()
            const groupTabs = TABS.filter(t => t.group === group && (!fq || t.label.toLowerCase().includes(fq) || t.description.toLowerCase().includes(fq)))
            if (!groupTabs.length) return null
            return (
            <div key={group} style={{ marginBottom: 12 }}>
              <p className="rlabel" style={{ fontSize: 10, fontFamily: "'General Sans',sans-serif", fontWeight: 600, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.11em', padding: '4px 14px', marginBottom: 4 }}>{group}</p>
              {groupTabs.map(tab => {
                const active = activeTab === tab.id
                const hue = ACCENT[tab.accent]
                return (
                  <button key={tab.id} onClick={() => handleTab(tab.id)}
                    data-tour={tab.id === 'keywords' ? 'tool-keywords' : undefined}
                    style={{
                      position: 'relative',
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 12px', borderRadius: 10, border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                      transition: 'background 0.15s, color 0.15s',
                      background: active ? withAlpha(hue, 0.12) : 'transparent',
                      color: active ? hue : C.inkSoft,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.canvas }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                    {/* Active indicator bar in the tool's hue */}
                    {active && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, borderRadius: 3, background: hue }} />}
                    {/* Icon carries the tool's hue for identity; a soft tile appears
                        only on the active item so the idle rail stays clean, not tiled. */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: active ? withAlpha(hue, 0.14) : 'transparent',
                      color: hue,
                      transition: 'background 0.15s',
                    }}><AnimIcon src={DASH_ICON[tab.id]} size={20} color={hue} active={active} target="button" /></span>
                    <span className="rlabel" style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: active ? C.ink : C.inkSoft, letterSpacing: '-0.01em' }}>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          )})}
          {navFilter.trim() && !TABS.some(t => t.label.toLowerCase().includes(navFilter.trim().toLowerCase()) || t.description.toLowerCase().includes(navFilter.trim().toLowerCase())) && (
            <p style={{ fontSize: 13, color: C.stone, padding: '6px 14px', lineHeight: 1.5 }}>No tools match &ldquo;{navFilter}&rdquo;.</p>
          )}
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
          <NavButton href="/profile" spinnerColor={C.ink} spinnerSize={17}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 10, border: 'none', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', color: C.inkSoft, fontSize: 14, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="rlabel">Profile</span>
          </NavButton>
          {user?.role === 'admin' && (
            <NavButton href="/admin" spinnerColor={C.ink} spinnerSize={17}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 10, border: 'none', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', color: C.inkSoft, fontSize: 14, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.canvas)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span className="rlabel">Admin</span>
            </NavButton>
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
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 14 }}>
            {/* Mobile drawer toggle - hidden on desktop via CSS */}
            <button className="rdash-burger" onClick={() => setNavOpen(o => !o)} aria-label="Toggle menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            {/* Active-tool icon in its own hue - no background chip */}
            <span className="rdash-titleicon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, flexShrink: 0, color: activeHue }}>
              <AnimIcon key={activeTab} src={DASH_ICON[activeTab]} size={26} color={activeHue} active />
            </span>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: '-0.03em', marginBottom: 2 }}>{activeInfo.label}</h1>
              <p className="rdash-desc" style={{ fontSize: 13.5, color: C.graphite }}>{activeInfo.description}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => window.dispatchEvent(new Event('rankkw:start-tour'))} title="Take a tour" aria-label="Take a tour"
              className="rdash-badge" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: C.paper, border: `1px solid ${C.ash}`, color: C.graphite, cursor: 'pointer', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </button>
            <NotificationBell />
            {credits && (
              <span className="rdash-badge" data-tour="credits" title={`${formatNumber(credits.credits)} of ${formatNumber(credits.limit)} daily credits left · 10 per tool use · resets midnight UTC`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, background: C.paper, color: C.ink, padding: '6px 12px', borderRadius: 999, fontFamily: "'General Sans',monospace", border: `1px solid ${credits.credits <= 0 ? C.orange : C.ash}`, fontWeight: 600, whiteSpace: 'nowrap' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={credits.credits <= 0 ? C.orange : C.charcoal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                {formatNumber(credits.credits)}<span style={{ color: C.stone, fontWeight: 500 }}>/{formatNumber(credits.limit)}</span>
              </span>
            )}
            {planInfo && (
              <span className="rdash-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, background: C.paper, color: C.ink, padding: '6px 13px', borderRadius: 999, fontFamily: "'General Sans',monospace", border: `1px solid ${C.ash}`, fontWeight: 600, whiteSpace: 'nowrap' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: planInfo.plan === 'free' ? C.stone : C.orange }} />
                {planInfo.label} plan
              </span>
            )}
            {planInfo && !['business', 'agency', 'enterprise', 'custom'].includes(planInfo.plan) && (
              <button data-tour="upgrade" onClick={() => triggerUpgrade({ title: 'Upgrade your plan', message: 'Unlock higher daily limits, Etsy Listing Pro images and more with a paid plan.' })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, background: C.orange, color: '#fff', padding: '7px 15px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                Upgrade
              </button>
            )}
            {user && (
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: activeHue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 600, transition: 'background 0.2s' }}>
                {user.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
        </div>

        {/* Content - the active tool's hue cascades into the shared kit (stat
            cards, section dots, buttons, search bars) via these CSS vars. */}
        <div className="rdash-content" data-tour="content" style={{
          flex: 1, padding: '22px 28px', overflowY: 'auto',
          ['--accent' as string]: activeHue,
          ['--accent-soft' as string]: withAlpha(activeHue, 0.12),
          ['--accent-ring' as string]: withAlpha(activeHue, 0.30),
        }}>
          {activeTab === 'overview' && <OnboardingChecklist onNavigate={(t) => handleTab(t as TabId)} />}
          <TabContent active={activeTab} onNavigate={handleTab} />
        </div>

        {/* Etsy attribution - REQUIRED VERBATIM by Etsy API Terms of Use (Section 6).
            This is a legal disclaimer, NOT a data-source "footprint": do not genericise it. */}
        <div className="rdash-footer" style={{ padding: '12px 28px', borderTop: `1px solid ${C.hair}`, background: C.paper, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 11.5, color: '#8a8a82', fontFamily: "'General Sans',monospace", lineHeight: 1.5, margin: 0 }}>
            The term &apos;Etsy&apos; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
          </p>
          <Link href="/methodology" style={{ fontSize: 11.5, color: C.orange, fontFamily: "'General Sans',monospace", textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>How our data works →</Link>
        </div>
      </main>
      <UpgradeModalHost />
      <DashboardTour />
      <ChatWidget />
    </div>
    </RealtimeProvider>
  )
}
