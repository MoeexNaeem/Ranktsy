'use client'
import Link from 'next/link'
import { useAuth, useLogout } from '@/hooks/useAuth'
import { C } from '@/utils'

const S = {
  nav: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 48px',
    background: 'rgba(252,252,247,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(28,58,19,0.1)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' },
  logoText: { fontWeight: 600, fontSize: 20, color: C.forest, letterSpacing: '-0.5px' },
  beta: { background: C.forest, color: C.snow, fontSize: 13, fontWeight: 500, padding: '2px 8px', borderRadius: 999 },
  links: { display: 'flex', gap: 32, listStyle: 'none' },
  link: { fontSize: 14, fontWeight: 400, color: '#000', textDecoration: 'none', transition: 'color 0.2s' },
  cta: { display: 'flex', gap: 12, alignItems: 'center' },
  login: {
    background: 'transparent', border: `1px solid ${C.forest}`, color: C.forest,
    padding: '8px 20px', borderRadius: 0, fontSize: 14, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.2s',
  },
  start: {
    background: C.forest, border: 'none', color: C.snow,
    padding: '10px 24px', borderRadius: 999, fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.2s',
  },
}

export function Navbar() {
  const { data: user } = useAuth()
  const logout = useLogout()

  return (
    <nav style={S.nav}>
      <Link href="/" style={S.logo}>
        <span style={S.logoText}>Ranksty</span>
        <span style={S.beta}>BETA</span>
      </Link>
      <ul style={S.links}>
        {[['#features','Features'],['#dashboard','Dashboard'],['#keywords','Keyword Tool'],['#pricing','Pricing']].map(([h,l]) => (
          <li key={h}><a href={h} style={S.link}>{l}</a></li>
        ))}
      </ul>
      <div style={S.cta}>
        {user ? (
          <>
            <Link href="/dashboard" style={{ ...S.start, textDecoration: 'none', display: 'inline-block' }}>
              Dashboard →
            </Link>
            <button
              onClick={() => logout.mutate()}
              style={S.login}
              onMouseEnter={e=>{ const b = e.currentTarget; b.style.background=C.forest; b.style.color=C.snow }}
              onMouseLeave={e=>{ const b = e.currentTarget; b.style.background='transparent'; b.style.color=C.forest }}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" style={{ ...S.login, textDecoration: 'none', display: 'inline-block' }}>
              Log in
            </Link>
            <Link href="/register" style={{ ...S.start, textDecoration: 'none', display: 'inline-block' }}>
              Start free →
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
