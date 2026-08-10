'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { IPopupAd } from '@/types'

/**
 * Global promotional popup. Fetches the active admin-managed ad and shows it
 * once per browser session on the marketing site (never inside the dashboard,
 * admin or auth flows). Two modes: a styled card with an animated price tag +
 * "Learn more" button, or an uploaded image that links out on click.
 */
const HIDE_ON = ['/dashboard', '/admin', '/login', '/register', '/forgot-password', '/reset-password']
const SESSION_PREFIX = 'rk-ad-seen-'

const O = '#FB5E09'
const INK = '#3D3E3B'

export function PopupAdHost() {
  const pathname = usePathname() || '/'
  const [ad, setAd] = useState<IPopupAd | null>(null)
  const [open, setOpen] = useState(false)

  const hidden = HIDE_ON.some(p => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    if (hidden) return
    let alive = true
    fetch('/api/popup-ad')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d?.success || !d.data) return
        const a = d.data as IPopupAd
        const id = a._id || 'ad'
        try { if (sessionStorage.getItem(SESSION_PREFIX + id)) return } catch { /* ignore */ }
        setAd(a)
        // Small delay so it doesn't slam the visitor the instant the page paints.
        setTimeout(() => { if (alive) setOpen(true) }, 1100)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [hidden])

  const dismiss = () => {
    setOpen(false)
    try { if (ad?._id) sessionStorage.setItem(SESSION_PREFIX + ad._id, '1') } catch { /* ignore */ }
  }

  if (!ad || !open || hidden) return null

  const isImage = ad.mode === 'image' && !!ad.imageUrl
  const ctaUrl = ad.ctaUrl || '/deals'
  const ctaExternal = /^https?:\/\//i.test(ctaUrl)

  return (
    <div className="rk-ad-overlay" onClick={dismiss}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(20,18,14,0.55)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="rk-ad-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ position: 'relative', width: '100%', maxWidth: isImage ? 560 : 460, background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,0.4)' }}>

        {/* Close */}
        <button onClick={dismiss} aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.9)', color: INK, cursor: 'pointer', fontSize: 18, lineHeight: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
          ×
        </button>

        {isImage ? (
          /* ── Image mode — the Canva design, clickable ─────────────────────── */
          ad.imageLink ? (
            <a href={ad.imageLink} target={/^https?:\/\//i.test(ad.imageLink) ? '_blank' : undefined} rel="noopener noreferrer" onClick={dismiss}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ad.imageUrl} alt={ad.title || 'Special offer'} style={{ width: '100%', display: 'block' }} />
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.imageUrl} alt={ad.title || 'Special offer'} style={{ width: '100%', display: 'block' }} />
          )
        ) : (
          /* ── Card mode — styled 1-Year offer with animated price tag ──────── */
          <div style={{ padding: '30px 30px 28px', textAlign: 'center' }}>
            {ad.badge && (
              <span style={{ display: 'inline-block', fontSize: 11, fontFamily: "'General Sans',monospace", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', background: O, padding: '5px 13px', borderRadius: 100, marginBottom: 16 }}>{ad.badge}</span>
            )}
            {ad.title && <h2 style={{ fontSize: 24, fontWeight: 600, color: INK, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>{ad.title}</h2>}
            {ad.description && <p style={{ fontSize: 14.5, color: '#5A5A52', lineHeight: 1.6, marginBottom: 20 }}>{ad.description}</p>}

            {ad.price && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                {/* animated price tag */}
                <div className="rk-price-tag" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#FB5E09,#D8480B)', color: '#fff', padding: '12px 20px 12px 24px', borderRadius: 12, boxShadow: '0 12px 26px -10px rgba(251,94,9,0.7)' }}>
                  {/* tag hole */}
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: '#fff', boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.15)' }} />
                  <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginLeft: 8 }}>{ad.price}</span>
                </div>
              </div>
            )}
            {ad.priceNote && <p style={{ fontSize: 12.5, fontFamily: "'General Sans',monospace", color: '#8a8a82', marginBottom: 22 }}>{ad.priceNote}</p>}

            {ctaExternal ? (
              <a href={ctaUrl} target="_blank" rel="noopener noreferrer" onClick={dismiss}
                style={{ display: 'inline-block', background: O, color: '#fff', textDecoration: 'none', fontSize: 15.5, fontWeight: 600, padding: '13px 30px', borderRadius: 100, boxShadow: '0 12px 26px -12px rgba(251,94,9,0.8)' }}>
                {ad.ctaLabel || 'Learn more'} →
              </a>
            ) : (
              <Link href={ctaUrl} onClick={dismiss}
                style={{ display: 'inline-block', background: O, color: '#fff', textDecoration: 'none', fontSize: 15.5, fontWeight: 600, padding: '13px 30px', borderRadius: 100, boxShadow: '0 12px 26px -12px rgba(251,94,9,0.8)' }}>
                {ad.ctaLabel || 'Learn more'} →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
