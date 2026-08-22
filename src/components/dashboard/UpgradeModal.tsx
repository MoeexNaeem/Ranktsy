'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { C } from '@/utils'
import { onUpgrade, type UpgradeInfo } from '@/lib/upgrade'
import { startCheckout } from '@/lib/checkout'

const SANS = "'General Sans',sans-serif"

// Two sensible upgrade targets surfaced in the modal; "See all plans" covers the rest.
const SUGGESTED = [
  { slug: 'pro', name: 'Pro', price: '$6.99 / mo', accent: '#FB5E09', desc: 'Etsy Listing Pro · 200 searches/day · trends & rank tracking' },
  { slug: 'business', name: 'Business', price: '$19.99 / mo', accent: '#0D9488', desc: '500 searches/day · 15 images/mo · multi-shop' },
]

/** Single global host for the upgrade modal - mount once (in the dashboard). */
export function UpgradeModalHost() {
  const [info, setInfo] = useState<UpgradeInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => onUpgrade(setInfo), [])
  if (!info) return null

  const close = () => setInfo(null)
  const choose = async (slug: string) => { setBusy(slug); try { await startCheckout(slug) } finally { setBusy(null) } }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(20,20,20,0.55)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: C.paper, borderRadius: 24, maxWidth: 480, width: '100%', padding: '30px 30px 26px', boxShadow: '0 34px 80px rgba(0,0,0,0.34)', position: 'relative' }}>
        <button onClick={close} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: 'none', background: C.bone, color: C.graphite, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontFamily: SANS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.orange, marginBottom: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />
          Upgrade
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em', marginBottom: 8 }}>{info.title}</h2>
        <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>{info.message}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SUGGESTED.map(s => (
            <button key={s.slug} disabled={!!busy} onClick={() => choose(s.slug)}
              style={{ textAlign: 'left', background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 16, padding: '16px 18px', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, opacity: busy && busy !== s.slug ? 0.6 : 1 }}>
              <span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15.5, fontWeight: 600, color: C.ink, marginBottom: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.accent }} /> {s.name}
                </span>
                <span style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.45 }}>{s.desc}</span>
              </span>
              <span style={{ flexShrink: 0, background: s.accent, color: '#fff', fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                {busy === s.slug ? '…' : s.price}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <Link href="/pricing" style={{ fontSize: 13.5, fontWeight: 600, color: C.orange, textDecoration: 'none' }}>See all plans →</Link>
          <button onClick={close} style={{ fontSize: 13.5, color: C.graphite, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Maybe later</button>
        </div>
      </div>
    </div>
  )
}
