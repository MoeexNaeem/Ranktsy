'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { C } from '@/utils'

const S = {
  nav: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 48px',
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(60,60,60,0.10)',
    boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 0, textDecoration: 'none' },
  beta: {
    background: C.orange, color: '#fff', fontSize: 11, fontWeight: 600,
    padding: '2px 8px', borderRadius: 999, marginLeft: 10,
    letterSpacing: '0.04em', textTransform: 'uppercase' as const,
  },
  links: { display: 'flex', gap: 28, listStyle: 'none', alignItems: 'center' },
  link: { fontSize: 14, fontWeight: 400, color: C.charcoal, textDecoration: 'none', transition: 'color 0.2s' },
  activeLink: { fontSize: 14, fontWeight: 600, color: C.orange, textDecoration: 'none' },
  divider: { width: 1, height: 16, background: 'rgba(60,60,60,0.15)', display: 'inline-block' },
  cta: { display: 'flex', gap: 12, alignItems: 'center' },
  login: {
    background: 'transparent', border: `1.5px solid ${C.orange}`, color: C.orange,
    padding: '8px 20px', borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.2s', textDecoration: 'none', display: 'inline-block',
  },
  start: {
    background: C.orange, border: 'none', color: '#fff',
    padding: '10px 24px', borderRadius: 999, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.2s',
    textDecoration: 'none', display: 'inline-block',
  },
}

const LANDING_LINKS = [
  ['#features', 'Features'],
  ['#dashboard', 'Dashboard'],
  ['#keywords', 'Keyword Tool'],
]

const PAGE_LINKS = [
  ['/about', 'About Us'],
  ['/contact', 'Contact'],
]

export function Navbar() {
  const { data: user } = useAuth()
  const logout = useLogout()
  const pathname = usePathname()
  const isHome = pathname === '/'

  return (
    <nav style={S.nav}>
      {/* Logo */}
      <Link href="/" style={S.logo}>
        <Image
          src="/website_logo.png"
          alt="Ranktsy — Etsy SEO Tools"
          width={140}
          height={48}
          style={{ objectFit: 'contain', display: 'block' }}
          priority
        />
        <span style={S.beta}>BETA</span>
      </Link>

      {/* Nav links */}
      <ul style={S.links}>
        {isHome && LANDING_LINKS.map(([h, l]) => (
          <li key={h}>
            <a href={h} style={S.link}
              onMouseEnter={e => { e.currentTarget.style.color = C.orange }}
              onMouseLeave={e => { e.currentTarget.style.color = C.charcoal }}
            >
              {l}
            </a>
          </li>
        ))}

        {isHome && <li><span style={S.divider} /></li>}

        {PAGE_LINKS.map(([href, label]) => {
          const active = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                style={active ? S.activeLink : S.link}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = C.orange }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = C.charcoal }}
              >
                {label}
                {active && (
                  <span style={{
                    display: 'block', height: 2,
                    background: C.orange, borderRadius: 999, marginTop: 2,
                  }} />
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* CTA buttons */}
      <div style={S.cta}>
        {user ? (
          <>
            <Link href="/dashboard" style={S.start}>Dashboard →</Link>
            <button
              onClick={() => logout.mutate()}
              style={S.login as React.CSSProperties}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = C.orange; b.style.color = '#fff' }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'transparent'; b.style.color = C.orange }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" style={S.login}>Log in</Link>
            <Link href="/register" style={S.start}>Start free →</Link>
          </>
        )}
      </div>
    </nav>
  )
}
