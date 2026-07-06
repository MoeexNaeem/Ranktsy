'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { C } from '@/utils'

const MONO = "'IBM Plex Mono',monospace"

const S = {
  shell: { position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 100 },
  strip: {
    background: C.charcoal, color: 'rgba(252,252,247,0.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '7px 16px', fontSize: 12, fontFamily: MONO, letterSpacing: '0.01em',
  },
  nav: {
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(16px) saturate(1.4)', WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
    borderBottom: `1px solid ${C.hair}`,
  },
  inner: {
    maxWidth: 1200, margin: '0 auto', padding: '13px 40px',
    display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24,
  },
  logoWrap: { display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none', justifySelf: 'start' },
  beta: {
    fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 100,
    letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: MONO,
    border: `1px solid ${C.hairInk}`, color: C.ink,
  },
  links: { display: 'flex', gap: 30, listStyle: 'none', alignItems: 'center', justifySelf: 'center', margin: 0, padding: 0 },
  link: { fontSize: 14, fontWeight: 400, color: '#3a4444', textDecoration: 'none', transition: 'color 0.15s', letterSpacing: '-0.01em' },
  activeLink: { fontSize: 14, fontWeight: 500, color: C.ink, textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: C.orange },
  cta: { display: 'flex', gap: 20, alignItems: 'center', justifySelf: 'end' },
  ghost: { background: 'transparent', border: 'none', color: C.ink, fontSize: 14, fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', padding: 0 },
  start: {
    background: C.orange, border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 1000,
    fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.18s',
    textDecoration: 'none', display: 'inline-block', letterSpacing: '-0.01em',
  },
}

const FEATURE_MENU: [string, string][] = [
  ['/#features', 'Overview'],
  ['/#keywords', 'Keyword Tool'],
  ['/fee-calculator', 'Fee Calculator'],
  ['/#dashboard', 'Live Dashboard'],
]
const PAGE_LINKS: [string, string][] = [
  ['/about', 'About'],
  ['/contact', 'Contact'],
]

function underlineOn(e: React.MouseEvent<HTMLAnchorElement>) { e.currentTarget.style.color = C.ink; e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.textUnderlineOffset = '5px'; e.currentTarget.style.textDecorationColor = C.orange }
function underlineOff(e: React.MouseEvent<HTMLAnchorElement>) { e.currentTarget.style.color = '#3a4444'; e.currentTarget.style.textDecoration = 'none' }

export function Navbar() {
  const { data: user } = useAuth()
  const logout = useLogout()
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [openDrop, setOpenDrop] = useState(false)

  return (
    <div style={S.shell}>
      {/* Announcement strip */}
      <div style={S.strip}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
        Private Beta — every feature is free while we&apos;re in beta.
      </div>

      {/* Main nav */}
      <nav style={S.nav}>
        <div className="rnav-inner" style={S.inner}>
          {/* Left: logo */}
          <Link href="/" style={S.logoWrap}>
            <Image src="/website_logo.png" alt="Ranktsy — Etsy SEO Tools" width={44} height={38} style={{ objectFit: 'contain', display: 'block' }} priority />
            <span style={S.beta}>Beta</span>
          </Link>

          {/* Center: links */}
          <ul className="rnav-links" style={S.links}>
            {isHome && (
              <li style={{ position: 'relative' }}
                onMouseEnter={() => setOpenDrop(true)}
                onMouseLeave={() => setOpenDrop(false)}>
                <button style={{ ...S.link, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: openDrop ? C.ink : '#3a4444' }}>
                  Features
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openDrop ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {openDrop && (
                  <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', paddingTop: 14 }}>
                    <div style={{ background: C.paper, border: `1px solid ${C.hairInk}`, borderRadius: 10, padding: 6, minWidth: 190, display: 'flex', flexDirection: 'column' }}>
                      {FEATURE_MENU.map(([h, l]) => (
                        <a key={h} href={h} onClick={() => setOpenDrop(false)}
                          style={{ fontSize: 13.5, color: '#3a4444', textDecoration: 'none', padding: '9px 12px', borderRadius: 6, transition: 'background 0.12s, color 0.12s', letterSpacing: '-0.01em' }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.bone; e.currentTarget.style.color = C.ink }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3a4444' }}>
                          {l}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            )}
            {PAGE_LINKS.map(([href, label]) => {
              const active = pathname === href
              return (
                <li key={href}>
                  <Link href={href} style={active ? S.activeLink : S.link}
                    onMouseEnter={!active ? underlineOn : undefined}
                    onMouseLeave={!active ? underlineOff : undefined}>
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Right: CTA */}
          <div style={S.cta}>
            {user ? (
              <>
                <button onClick={() => logout.mutate()} style={S.ghost}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                  Log out
                </button>
                <Link href="/dashboard" style={S.start}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  Dashboard →
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" style={S.ghost}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                  Log in
                </Link>
                <Link href="/register" style={S.start}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  Start free →
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </div>
  )
}
