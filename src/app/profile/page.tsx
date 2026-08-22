'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/landing/Navbar'
import { Card } from '@/components/dashboard/kit'
import { NavButton } from '@/components/ui/NavButton'
import { C } from '@/utils'

const MONO = "'General Sans',monospace"

interface Profile {
  name: string; email: string; role: 'user' | 'admin'; plan: string
  isVerified: boolean; connectedShops: string[]; savedKeywords: number; searches: number; createdAt: string | null
}

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6E6E64', marginBottom: 8 }
const input: React.CSSProperties = { width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', boxSizing: 'border-box' }
const btn: React.CSSProperties = { background: C.orange, color: '#fff', border: 'none', borderRadius: 28, padding: '11px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '-'

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'orange' | 'green' }) {
  const map = { neutral: { bg: C.bone, c: C.ink }, orange: { bg: C.orangeFaint, c: C.orange }, green: { bg: C.successBg, c: C.success } }[tone]
  return <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', background: map.bg, color: map.c, padding: '3px 10px', borderRadius: 100 }}>{children}</span>
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.hair}` }}>
      <span style={{ fontSize: 13, color: '#6E6E64' }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, fontFamily: MONO }}>{v}</span>
    </div>
  )
}

export default function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  // {ok,text} rather than a string: success used to be inferred from the text
  // starting with a "✓" glyph, which coupled state logic to display copy (and to
  // a character General Sans doesn't even carry). Mirrors pwdMsg below.
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [cur, setCur] = useState(''); const [nw, setNw] = useState('')
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  useEffect(() => {
    fetch('/api/auth/profile').then(r => r.json()).then(d => {
      if (d.success) { setP(d.data); setName(d.data.name) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const saveName = useCallback(async () => {
    const r = await fetch('/api/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const d = await r.json()
    setNameMsg(d.success
      ? { ok: true, text: 'Saved' }
      : { ok: false, text: d.errors?.name || d.error || 'Failed' })
    if (d.success) setP(pp => pp ? { ...pp, name } : pp)
    setTimeout(() => setNameMsg(null), 2500)
  }, [name])

  const changePwd = useCallback(async () => {
    const r = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: cur, newPassword: nw }) })
    const d = await r.json()
    if (d.success) { setPwdMsg({ ok: true, text: 'Password updated' }); setCur(''); setNw('') }
    else setPwdMsg({ ok: false, text: d.errors?.currentPassword || d.errors?.newPassword || d.error || 'Failed' })
    setTimeout(() => setPwdMsg(null), 3500)
  }, [cur, nw])

  const deleteAccount = useCallback(async () => {
    if (!p || deleteConfirm.trim().toLowerCase() !== p.email.toLowerCase()) return
    setDeleting(true); setDeleteErr('')
    const r = await fetch('/api/auth/account', { method: 'DELETE' })
    const d = await r.json().catch(() => null)
    if (r.ok && d?.success) { window.location.href = '/' }
    else { setDeleteErr(d?.error || 'Could not delete your account. Please try again.'); setDeleting(false) }
  }, [p, deleteConfirm])

  return (
    <>
      <Navbar />
      <main className="rpage" style={{ background: C.canvas, minHeight: '100vh', padding: '150px 40px 96px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#6E6E64', marginBottom: 18 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} /> Your account
          </div>

          {loading ? (
            <div className="shimmer" style={{ height: 320, borderRadius: 8, background: '#e8e7e2' }} />
          ) : !p ? (
            <p style={{ color: '#6E6E64' }}>Couldn&apos;t load your profile. Please <Link href="/login" style={{ color: C.orange }}>log in</Link> again.</p>
          ) : (
            <>
              {/* Identity header */}
              <div className="rstack-sm" style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 500, flexShrink: 0 }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 style={{ fontSize: 'clamp(26px,3vw,34px)', fontWeight: 500, color: C.ink, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{p.name}</h1>
                  <p style={{ fontSize: 14, color: '#6E6E64', marginTop: 4, marginBottom: 8 }}>{p.email}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Pill tone="orange">{p.plan} plan</Pill>
                    {p.role === 'admin' && <Pill tone="green">Admin</Pill>}
                    <Pill tone={p.isVerified ? 'green' : 'neutral'}>{p.isVerified ? 'Verified' : 'Unverified'}</Pill>
                  </div>
                </div>
                <div className="rfull-sm rwrap-sm" style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                  {p.role === 'admin' && <NavButton href="/admin" spinnerColor="#fff" style={{ ...btn, background: C.ink }}>Admin →</NavButton>}
                  <NavButton href="/dashboard" spinnerColor={C.ink} style={{ ...btn, background: 'transparent', color: C.ink, border: `1px solid ${C.hairInk}` }}>Dashboard →</NavButton>
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
                  <Row k="Etsy shops" v={p.connectedShops.length ? p.connectedShops.join(', ') : 'Not linked'} />
                  <Row k="Keyword searches" v={p.searches} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0' }}>
                    <span style={{ fontSize: 13, color: '#6E6E64' }}>Saved keywords</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, fontFamily: MONO }}>{p.savedKeywords}</span>
                  </div>
                </Card>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Plan */}
                  <Card pad="20px">
                    <h3 style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 12 }}>Your plan</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <Pill tone="orange">{p.plan} plan</Pill>
                      <NavButton href="/pricing" spinnerColor="#fff" style={{ ...btn, padding: '9px 18px', fontSize: 13.5 }}>Upgrade plan →</NavButton>
                    </div>
                  </Card>

                  {/* Edit name */}
                  <Card pad="20px">
                    <h3 style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 14 }}>Edit profile</h3>
                    <label style={label}>Display name</label>
                    <input value={name} onChange={e => setName(e.target.value)} style={input} maxLength={60} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                      <button onClick={saveName} style={btn}>Save</button>
                      {nameMsg && <span style={{ fontSize: 12.5, color: nameMsg.ok ? C.success : C.danger }}>{nameMsg.text}</span>}
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

                  {/* Danger zone */}
                  <Card pad="20px" style={{ borderColor: C.dangerBg }}>
                    <h3 style={{ fontSize: 15, fontWeight: 500, color: C.danger, marginBottom: 8 }}>Danger zone</h3>
                    <p style={{ fontSize: 12.5, color: '#6E6E64', lineHeight: 1.55, marginBottom: 14 }}>
                      Permanently delete your account, search history and connected shops. This cannot be undone.
                    </p>
                    <button onClick={() => { setShowDelete(true); setDeleteConfirm(''); setDeleteErr('') }}
                      style={{ background: 'transparent', border: `1px solid ${C.dangerBg}`, color: C.danger, borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                      Delete my account
                    </button>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {showDelete && p && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
          onClick={() => !deleting && setShowDelete(false)}>
          <div style={{ background: C.paper, borderRadius: 16, padding: '26px 28px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 10 }}>Delete your account?</h3>
            <p style={{ fontSize: 13.5, color: '#6E6E64', lineHeight: 1.6, marginBottom: 16 }}>
              This permanently deletes your account, search history and connected Etsy shops. This cannot be undone.
              Type <strong style={{ color: C.ink }}>{p.email}</strong> to confirm.
            </p>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={p.email} style={input} />
            {deleteErr && <p style={{ fontSize: 12.5, color: C.danger, marginTop: 10 }}>{deleteErr}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                style={{ background: 'transparent', border: `1px solid ${C.hairInk}`, color: C.ink, borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={deleteAccount} disabled={deleting || deleteConfirm.trim().toLowerCase() !== p.email.toLowerCase()}
                style={{
                  background: C.danger, border: 'none', color: '#fff', borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit',
                  cursor: (deleting || deleteConfirm.trim().toLowerCase() !== p.email.toLowerCase()) ? 'not-allowed' : 'pointer',
                  opacity: (deleting || deleteConfirm.trim().toLowerCase() !== p.email.toLowerCase()) ? 0.5 : 1,
                }}>
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
