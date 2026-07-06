'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/landing/Navbar'
import { Card } from '@/components/dashboard/kit'
import { C } from '@/utils'

const MONO = "'IBM Plex Mono',monospace"

interface Profile {
  name: string; email: string; role: 'user' | 'admin'; plan: string
  isVerified: boolean; etsyShopId: string | null; savedKeywords: number; searches: number; createdAt: string | null
}

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#3a4444', marginBottom: 8 }
const input: React.CSSProperties = { width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', boxSizing: 'border-box' }
const btn: React.CSSProperties = { background: C.orange, color: '#fff', border: 'none', borderRadius: 1000, padding: '11px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'orange' | 'green' }) {
  const map = { neutral: { bg: C.bone, c: C.ink }, orange: { bg: C.orangeFaint, c: C.orange }, green: { bg: C.successBg, c: C.success } }[tone]
  return <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: map.bg, color: map.c, padding: '3px 10px', borderRadius: 100 }}>{children}</span>
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.hair}` }}>
      <span style={{ fontSize: 13, color: '#3a4444' }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, fontFamily: MONO }}>{v}</span>
    </div>
  )
}

export default function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [nameMsg, setNameMsg] = useState('')
  const [cur, setCur] = useState(''); const [nw, setNw] = useState('')
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/profile').then(r => r.json()).then(d => {
      if (d.success) { setP(d.data); setName(d.data.name) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const saveName = useCallback(async () => {
    const r = await fetch('/api/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const d = await r.json()
    setNameMsg(d.success ? '✓ Saved' : (d.errors?.name || d.error || 'Failed'))
    if (d.success) setP(pp => pp ? { ...pp, name } : pp)
    setTimeout(() => setNameMsg(''), 2500)
  }, [name])

  const changePwd = useCallback(async () => {
    const r = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: cur, newPassword: nw }) })
    const d = await r.json()
    if (d.success) { setPwdMsg({ ok: true, text: '✓ Password updated' }); setCur(''); setNw('') }
    else setPwdMsg({ ok: false, text: d.errors?.currentPassword || d.errors?.newPassword || d.error || 'Failed' })
    setTimeout(() => setPwdMsg(null), 3500)
  }, [cur, nw])

  return (
    <>
      <Navbar />
      <main style={{ background: C.canvas, minHeight: '100vh', padding: '150px 40px 96px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#3a4444', marginBottom: 18 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} /> Your account
          </div>

          {loading ? (
            <div className="shimmer" style={{ height: 320, borderRadius: 8, background: '#e8e7e2' }} />
          ) : !p ? (
            <p style={{ color: '#3a4444' }}>Couldn&apos;t load your profile. Please <Link href="/login" style={{ color: C.orange }}>log in</Link> again.</p>
          ) : (
            <>
              {/* Identity header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, flexShrink: 0 }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 style={{ fontSize: 'clamp(26px,3vw,34px)', fontWeight: 300, color: C.ink, letterSpacing: '-1px', lineHeight: 1.1 }}>{p.name}</h1>
                  <p style={{ fontSize: 14, color: '#3a4444', marginTop: 4, marginBottom: 8 }}>{p.email}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Pill tone="orange">{p.plan} plan</Pill>
                    {p.role === 'admin' && <Pill tone="green">Admin</Pill>}
                    <Pill tone={p.isVerified ? 'green' : 'neutral'}>{p.isVerified ? 'Verified' : 'Unverified'}</Pill>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                  {p.role === 'admin' && <Link href="/admin" style={{ ...btn, background: C.ink, textDecoration: 'none' }}>Admin →</Link>}
                  <Link href="/dashboard" style={{ ...btn, background: 'transparent', color: C.ink, border: `1px solid ${C.hairInk}`, textDecoration: 'none' }}>Dashboard →</Link>
                </div>
              </div>

              <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                {/* Account details */}
                <Card pad="20px">
                  <h3 style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 8 }}>Account details</h3>
                  <Row k="Email" v={p.email} />
                  <Row k="Member since" v={fmtDate(p.createdAt)} />
                  <Row k="Plan" v={p.plan} />
                  <Row k="Role" v={p.role} />
                  <Row k="Etsy shop" v={p.etsyShopId ?? 'Not linked'} />
                  <Row k="Keyword searches" v={p.searches} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0' }}>
                    <span style={{ fontSize: 13, color: '#3a4444' }}>Saved keywords</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, fontFamily: MONO }}>{p.savedKeywords}</span>
                  </div>
                </Card>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Edit name */}
                  <Card pad="20px">
                    <h3 style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 14 }}>Edit profile</h3>
                    <label style={label}>Display name</label>
                    <input value={name} onChange={e => setName(e.target.value)} style={input} maxLength={60} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                      <button onClick={saveName} style={btn}>Save</button>
                      {nameMsg && <span style={{ fontSize: 12.5, color: nameMsg.startsWith('✓') ? C.success : C.danger }}>{nameMsg}</span>}
                    </div>
                  </Card>

                  {/* Change password */}
                  <Card pad="20px">
                    <h3 style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 14 }}>Change password</h3>
                    <label style={label}>Current password</label>
                    <input type="password" value={cur} onChange={e => setCur(e.target.value)} style={{ ...input, marginBottom: 12 }} />
                    <label style={label}>New password</label>
                    <input type="password" value={nw} onChange={e => setNw(e.target.value)} placeholder="Min 8 chars, 1 uppercase, 1 number" style={input} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                      <button onClick={changePwd} style={btn} disabled={!cur || !nw}>Update password</button>
                      {pwdMsg && <span style={{ fontSize: 12.5, color: pwdMsg.ok ? C.success : C.danger }}>{pwdMsg.text}</span>}
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}
