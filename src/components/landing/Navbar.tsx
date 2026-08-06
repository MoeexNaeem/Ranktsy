'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

/* ── Icon set (inline SVG — 'General Sans' has no emoji glyphs) ───────────────── */
type IconName =
  | 'search' | 'users' | 'trend' | 'trophy' | 'flame' | 'tag' | 'wand' | 'check'
  | 'bars' | 'sparkle' | 'bolt' | 'calc' | 'grid' | 'dollar' | 'arrow' | 'info'
  | 'book' | 'mail' | 'shield'

/* Accurate Lucide (MIT) glyphs — one consistent, professionally-drawn family at a
   uniform 2px weight, replacing the earlier approximated outlines. */
const ICONS: Record<IconName, React.ReactNode> = {
  search:  <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  users:   <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  trend:   <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  trophy:  <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>,
  flame:   <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2.5 4.9 4 6.5 2 2 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></>,
  tag:     <><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>,
  wand:    <><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" /></>,
  check:   <><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>,
  bars:    <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>,
  sparkle: <><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></>,
  bolt:    <><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></>,
  calc:    <><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M16 10h.01" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /></>,
  grid:    <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>,
  dollar:  <><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  arrow:   <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  info:    <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
  book:    <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></>,
  mail:    <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  shield:  <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  )
}

/* ── Menu data — every link points at a real page / on-page anchor / dashboard tool.
   Dashboard tools deep-link via /dashboard?tab=<id>, which DashboardLayout opens on
   mount. Each item carries an accent colour for its icon chip. ────────────────── */
type Item = { href: string; label: string; icon: IconName }
type Col = { title: string; items: Item[] }

const FEATURES_COLS: Col[] = [
  {
    title: 'Research',
    items: [
      { href: '/keyword-research',    label: 'Keyword Research',    icon: 'search' },
      { href: '/competitor-analysis', label: 'Competitor Analysis', icon: 'users' },
      { href: '/trend-analysis',      label: 'Trends & Demand',     icon: 'trend' },
      { href: '/top-sellers',         label: 'Top Sellers',         icon: 'trophy' },
      { href: '/find-hot-products',   label: 'Find Hot Products',   icon: 'flame' },
    ],
  },
  {
    title: 'Optimize',
    items: [
      { href: '/tag-optimizer',           label: 'Tag Optimizer',    icon: 'tag' },
      { href: '/etsy-listing-generator',  label: 'Etsy Listing Pro', icon: 'wand' },
      { href: '/ai-title-tag-generator',  label: 'AI Title & Tags',  icon: 'sparkle' },
      { href: '/listing-audit',           label: 'Listing Audit',    icon: 'check' },
      { href: '/shop-analytics',          label: 'Shop Analytics',   icon: 'bars' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/#keywords',      label: 'Live Keyword Tool', icon: 'bolt' },
      { href: '/fee-calculator', label: 'Fee Calculator',    icon: 'calc' },
      { href: '/#dashboard',     label: 'Dashboard Preview', icon: 'grid' },
      { href: '/pricing',        label: 'Pricing Plans',     icon: 'dollar' },
    ],
  },
]

const RESOURCES_COLS: Col[] = [
  {
    title: 'Company',
    items: [
      { href: '/about',       label: 'About us',    icon: 'info' },
      { href: '/methodology', label: 'Methodology', icon: 'book' },
      { href: '/contact',     label: 'Contact',     icon: 'mail' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { href: '/terms',         label: 'Terms of Service', icon: 'book' },
      { href: '/privacy',       label: 'Privacy Policy',   icon: 'shield' },
      { href: '/refund-policy', label: 'Refund Policy',    icon: 'dollar' },
    ],
  },
]

const S = {
  shell: { position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 100 },
  strip: {
    background: C.charcoal, color: '#F5F5EB',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '8px 16px', fontSize: 12.5, fontFamily: SANS, fontWeight: 500, letterSpacing: '0.01em',
  },
  nav: { background: 'rgba(245,245,235,0.85)', backdropFilter: 'saturate(180%) blur(10px)', WebkitBackdropFilter: 'saturate(180%) blur(10px)', borderBottom: `1px solid ${C.ash}`, position: 'relative' as const },
  inner: {
    maxWidth: 1200, margin: '0 auto', padding: '11px 40px',
    display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24,
  },
  logoWrap: { display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none', justifySelf: 'start' },
  stripLink: { color: '#F5F5EB', textDecoration: 'underline', textUnderlineOffset: '3px', fontWeight: 600 },
  links: { display: 'flex', gap: 6, listStyle: 'none', alignItems: 'center', justifySelf: 'center', margin: 0, padding: 0 },
  trigger: {
    fontSize: 15, fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '-0.01em',
    padding: '8px 14px', borderRadius: 10, transition: 'background 0.15s, color 0.15s',
  },
  cta: { display: 'flex', gap: 12, alignItems: 'center', justifySelf: 'end' },
  login: {
    border: `1px solid ${C.ash}`, background: 'transparent', color: C.ink, fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', padding: '9px 18px', borderRadius: 24,
    transition: 'border-color 0.15s, background 0.15s', display: 'inline-block',
  },
  start: {
    background: C.orange, border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 24,
    fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.18s',
    textDecoration: 'none', display: 'inline-block', letterSpacing: '-0.01em', boxShadow: '0 6px 16px rgba(251,94,9,0.28)',
  },
  burger: {
    display: 'none', background: 'transparent', border: `1px solid ${C.ash}`, borderRadius: 10,
    width: 42, height: 40, cursor: 'pointer', color: C.ink, alignItems: 'center', justifyContent: 'center',
  },
}

/* One icon-chip link — monochrome, with the single orange accent applied on hover
   only (see .rnav-link / .rnav-chip in globals.css). `block` = roomier drawer row. */
function MegaLink({ href, label, icon, onClose, block }: Item & { onClose: () => void; block?: boolean }) {
  return (
    <a href={href} onClick={onClose} className={`rnav-link${block ? ' block' : ''}`}>
      <span className="rnav-chip"><Icon name={icon} /></span>
      <span className="rnav-label">{label}</span>
    </a>
  )
}

/* Contained, rounded mega card floating below the nav (not full-bleed). The
   transparent wrapper bridges the gap so hovering onto the card keeps it open. */
function MegaCard({ cols, footer, onClose }: { cols: Col[]; footer?: boolean; onClose: () => void }) {
  return (
    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', paddingTop: 12, zIndex: 60 }}>
      <div style={{ background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 16, boxShadow: '0 26px 54px rgba(61,62,59,0.18)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, minmax(200px, 1fr))`, padding: '22px 18px' }}>
          {cols.map((c, i) => (
            <div key={c.title} style={{ padding: '0 12px', borderLeft: i ? `1px solid ${C.bone}` : 'none' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.11em', color: C.stone, textTransform: 'uppercase', padding: '2px 12px 14px', fontFamily: SANS }}>
                {c.title}
              </div>
              {c.items.map(it => <MegaLink key={it.href + it.label} {...it} onClose={onClose} />)}
            </div>
          ))}
        </div>
        {footer && (
          <a href="/dashboard" onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 26px', background: C.orangeFaint, borderTop: `1px solid ${C.ash}`, textDecoration: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: C.ink, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
              <span style={{ color: C.orange, display: 'inline-flex' }}><Icon name="grid" /></span>
              Explore all 33 Etsy SEO tools
            </span>
            <span style={{ color: C.orange, display: 'inline-flex' }}><Icon name="arrow" /></span>
          </a>
        )}
      </div>
    </div>
  )
}

export function Navbar() {
  const { data: user } = useAuth()
  const logout = useLogout()
  const [openMenu, setOpenMenu] = useState<'features' | 'resources' | null>(null)
  const [drawer, setDrawer] = useState(false)
  const closeAll = () => { setOpenMenu(null); setDrawer(false) }

  const caret = (open: boolean) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )

  const triggerStyle = (name: 'features' | 'resources') => ({
    ...S.trigger,
    background: openMenu === name ? C.orangeFaint : 'transparent',
    color: openMenu === name ? C.orange : C.graphite,
  })

  return (
    <div style={S.shell}>
      {/* Announcement strip */}
      <div className="rnav-strip" style={S.strip}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
        Flexible plans for every stage — start free.{' '}
        <Link href="/pricing" style={S.stripLink}>See pricing →</Link>
      </div>

      {/* Main nav */}
      <nav style={S.nav} onMouseLeave={() => setOpenMenu(null)}>
        <div className="rnav-inner" style={S.inner}>
          {/* Left: logo */}
          <Link href="/" style={S.logoWrap} onMouseEnter={() => setOpenMenu(null)}>
            <Image src="/website_logo.png" alt="Rankkw — Etsy SEO Tools" width={44} height={38} style={{ objectFit: 'contain', display: 'block' }} priority />
          </Link>

          {/* Center: triggers */}
          <ul className="rnav-links" style={S.links}>
            <li>
              <button style={triggerStyle('features')} onMouseEnter={() => setOpenMenu('features')}>
                Features {caret(openMenu === 'features')}
              </button>
            </li>
            <li>
              <button style={triggerStyle('resources')} onMouseEnter={() => setOpenMenu('resources')}>
                Resources {caret(openMenu === 'resources')}
              </button>
            </li>
            <li>
              <Link href="/pricing" style={{ ...S.trigger, color: C.graphite, textDecoration: 'none' }} onMouseEnter={e => { setOpenMenu(null); e.currentTarget.style.background = C.bone; e.currentTarget.style.color = C.ink }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.graphite }}>
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/blogs" style={{ ...S.trigger, color: C.graphite, textDecoration: 'none' }} onMouseEnter={e => { setOpenMenu(null); e.currentTarget.style.background = C.bone; e.currentTarget.style.color = C.ink }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.graphite }}>
                Blog
              </Link>
            </li>
          </ul>

          {/* Right: CTA + burger */}
          <div className="rnav-cta" style={S.cta} onMouseEnter={() => setOpenMenu(null)}>
            {user ? (
              <>
                <button className="rnav-cta-desktop" onClick={() => logout.mutate()} style={S.login}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.ink)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.ash)}>
                  Log out
                </button>
                <Link href="/dashboard" style={S.start}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  Dashboard →
                </Link>
              </>
            ) : (
              <>
                <Link className="rnav-cta-desktop" href="/login" style={S.login}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.ink)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.ash)}>
                  Log in
                </Link>
                <Link href="/register" style={S.start}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  Start free →
                </Link>
              </>
            )}
            {/* Mobile burger */}
            <button className="rnav-burger" style={S.burger} aria-label="Open menu" onClick={() => setDrawer(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* Contained mega cards — nav descendants, so moving onto them keeps them open */}
        {openMenu === 'features' && <MegaCard cols={FEATURES_COLS} footer onClose={() => setOpenMenu(null)} />}
        {openMenu === 'resources' && <MegaCard cols={RESOURCES_COLS} onClose={() => setOpenMenu(null)} />}
      </nav>

      {/* ── Mobile drawer ───────────────────────────────────────────────────────
          Wrapped in a viewport-sized clipping layer: a position:fixed panel escapes
          body's overflow clip, so the off-canvas (translateX(100%)) panel would add
          page width. This layer (overflow:hidden, inset:0) contains it — without any
          global overflow change that would break the How-it-works sticky pin. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 190, overflow: 'hidden', pointerEvents: drawer ? 'auto' : 'none' }}>
        <div onClick={closeAll} aria-hidden
          style={{ position: 'absolute', inset: 0, background: 'rgba(61,62,59,0.45)', opacity: drawer ? 1 : 0, transition: 'opacity 0.25s' }} />
        <aside style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'min(350px, 88vw)', background: C.paper, transform: drawer ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)', boxShadow: '-20px 0 50px rgba(61,62,59,0.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `1px solid ${C.ash}` }}>
          <Image src="/website_logo.png" alt="Rankkw" width={40} height={34} style={{ objectFit: 'contain' }} />
          <button aria-label="Close menu" onClick={closeAll} style={{ background: 'transparent', border: `1px solid ${C.ash}`, borderRadius: 10, width: 38, height: 38, cursor: 'pointer', color: C.ink, display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '14px 12px 20px', flex: 1 }}>
          {[...FEATURES_COLS, ...RESOURCES_COLS].map(col => (
            <div key={col.title} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.11em', color: C.stone, textTransform: 'uppercase', padding: '10px 12px 4px', fontFamily: SANS }}>
                {col.title}
              </div>
              {col.items.map(it => <MegaLink key={it.href + it.label} {...it} onClose={closeAll} block />)}
            </div>
          ))}
          <a href="/pricing" onClick={closeAll} className="rnav-link block">
            <span className="rnav-chip"><Icon name="dollar" /></span>
            <span className="rnav-label">Pricing</span>
          </a>
          <a href="/blogs" onClick={closeAll} className="rnav-link block">
            <span className="rnav-chip"><Icon name="book" /></span>
            <span className="rnav-label">Blog</span>
          </a>
        </div>

        <div style={{ borderTop: `1px solid ${C.ash}`, padding: 16, display: 'grid', gap: 10 }}>
          {user ? (
            <>
              <Link href="/dashboard" onClick={closeAll} style={{ ...S.start, textAlign: 'center', boxShadow: 'none' }}>Go to dashboard →</Link>
              <button onClick={() => { logout.mutate(); closeAll() }} style={{ ...S.login, textAlign: 'center' }}>Log out</button>
            </>
          ) : (
            <>
              <Link href="/register" onClick={closeAll} style={{ ...S.start, textAlign: 'center', boxShadow: 'none' }}>Start free →</Link>
              <Link href="/login" onClick={closeAll} style={{ ...S.login, textAlign: 'center' }}>Log in</Link>
            </>
          )}
        </div>
      </aside>
      </div>
    </div>
  )
}
