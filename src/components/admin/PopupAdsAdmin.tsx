'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { C } from '@/utils'
import { Card, SectionTitle, primaryBtn, MONO, tableCard, tableHead, th, tableRow, EmptyState } from '@/components/dashboard/kit'
import type { IPopupAd } from '@/types'

type AdRow = IPopupAd & { _id: string }

const field: React.CSSProperties = { width: '100%', background: C.snow, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '10px 13px', fontSize: 14.5, fontFamily: 'inherit', color: C.ink, outline: 'none', boxSizing: 'border-box' }
const label: React.CSSProperties = { fontSize: 12, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'block' }
const chip: React.CSSProperties = { fontSize: 12.5, fontFamily: MONO, border: `1px solid ${C.ash}`, background: C.paper, borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: C.ink }

const GRID = '1.4fr 0.7fr 0.9fr 1.3fr'

const BLANK: Partial<IPopupAd> = { mode: 'card', enabled: false, ctaLabel: 'Learn more' }

export function PopupAdsAdmin() {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [ads, setAds] = useState<AdRow[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [id, setId] = useState<string | null>(null)
  const [f, setF] = useState<Partial<IPopupAd>>(BLANK)
  const set = (k: keyof IPopupAd, v: unknown) => setF(p => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const { data } = await axios.get('/api/admin/popup-ads')
      if (data?.success) setAds(data.data.ads)
      else setErr(data?.error || 'Failed to load')
    } catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Failed to load') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const startNew = () => { setId(null); setF(BLANK); setView('edit') }
  const startEdit = (a: AdRow) => { setId(a._id); setF({ ...a }); setView('edit') }

  const save = async () => {
    setSaving(true); setErr('')
    try {
      if (id) await axios.put(`/api/admin/popup-ads/${id}`, f)
      else await axios.post('/api/admin/popup-ads', f)
      await load(); setView('list')
    } catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Save failed') }
    finally { setSaving(false) }
  }

  const toggleEnabled = async (a: AdRow) => {
    try { await axios.put(`/api/admin/popup-ads/${a._id}`, { enabled: !a.enabled }); await load() }
    catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Failed') }
  }

  const del = async (adId: string) => {
    if (!window.confirm('Delete this ad permanently?')) return
    try { await axios.delete(`/api/admin/popup-ads/${adId}`); await load() }
    catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Delete failed') }
  }

  // ─── List ──────────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 24px 60px' }}>
        <SectionTitle right={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/admin" style={{ ...chip, textDecoration: 'none' }}>← Admin</Link>
            <button onClick={startNew} style={{ ...primaryBtn, height: 38 }}>+ New ad</button>
          </div>
        }>Popup ads</SectionTitle>

        <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.55, marginBottom: 16 }}>
          The popup shows to visitors on the marketing site (once per session, never inside the dashboard). Only one ad can be <strong>enabled</strong> at a time — enabling one turns the others off.
        </p>
        {err && <p style={{ color: C.danger, fontSize: 13.5, marginBottom: 12 }}>{err}</p>}

        {loading ? (
          <div className="shimmer" style={{ height: 200, borderRadius: 14, background: '#e8e7e2' }} />
        ) : ads.length === 0 ? (
          <EmptyState icon="📣" title="No ads yet" sub="Create your first popup ad." />
        ) : (
          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>{['Ad', 'Mode', 'Live', 'Actions'].map((h, i) => <span key={i} style={th}>{h}</span>)}</div>
            {ads.map(a => (
              <div key={a._id} style={tableRow(GRID)}>
                <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || (a.mode === 'image' ? '(image ad)' : '(untitled)')}</span>
                <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>{a.mode}</span>
                <span>
                  <button onClick={() => toggleEnabled(a)} style={{ fontSize: 11.5, fontFamily: MONO, padding: '4px 11px', borderRadius: 100, cursor: 'pointer', border: `1px solid ${a.enabled ? '#1F8A4C' : C.ash}`, background: a.enabled ? 'rgba(31,138,76,0.12)' : C.paper, color: a.enabled ? '#1F8A4C' : C.graphite }}>
                    {a.enabled ? '● Live' : 'Off'}
                  </button>
                </span>
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => startEdit(a)} style={chip}>Edit</button>
                  <button onClick={() => del(a._id)} style={{ ...chip, color: C.danger, borderColor: 'rgba(207,70,58,0.3)' }}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Editor ────────────────────────────────────────────────────────────────
  const isImage = f.mode === 'image'
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 24px 60px' }}>
      <SectionTitle right={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setView('list')} style={chip}>← Back</button>
          <button onClick={save} disabled={saving} style={{ ...primaryBtn, height: 38, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save ad'}</button>
        </div>
      }>{id ? 'Edit ad' : 'New ad'}</SectionTitle>

      {err && <p style={{ color: C.danger, fontSize: 13.5, marginBottom: 12 }}>{err}</p>}

      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <label style={label}>Mode</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              {(['card', 'image'] as const).map(m => (
                <button key={m} onClick={() => set('mode', m)} style={{ ...chip, flex: 1, textAlign: 'center', background: f.mode === m ? C.orange : C.paper, color: f.mode === m ? '#fff' : C.ink, borderColor: f.mode === m ? C.orange : C.ash }}>{m === 'card' ? 'Styled card' : 'Uploaded image'}</button>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: C.stone, lineHeight: 1.5 }}>{isImage ? 'Show a hosted image (e.g. a Canva export) that links out when clicked.' : 'A built-in styled card with an animated price tag and a Learn-more button.'}</p>
          </Card>

          {isImage ? (
            <Card>
              <label style={label}>Image URL (paste a hosted / Canva export link)</label>
              <input style={field} value={f.imageUrl || ''} onChange={e => set('imageUrl', e.target.value)} placeholder="https://…/your-ad.png" />
              {f.imageUrl && <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.hair}` }}><img src={f.imageUrl} alt="preview" style={{ width: '100%', display: 'block' }} /></div>}
              <label style={{ ...label, marginTop: 12 }}>Click link (where the image goes when clicked)</label>
              <input style={field} value={f.imageLink || ''} onChange={e => set('imageLink', e.target.value)} placeholder="/deals/pro-1-year-plan or https://…" />
            </Card>
          ) : (
            <Card>
              <label style={label}>Badge (optional)</label>
              <input style={field} value={f.badge || ''} onChange={e => set('badge', e.target.value)} placeholder="Best value" />
              <label style={{ ...label, marginTop: 12 }}>Title</label>
              <input style={field} value={f.title || ''} onChange={e => set('title', e.target.value)} placeholder="Pro · 1-Year — Best Value" />
              <label style={{ ...label, marginTop: 12 }}>Description</label>
              <textarea style={{ ...field, minHeight: 80, resize: 'vertical' }} value={f.description || ''} onChange={e => set('description', e.target.value)} placeholder="A full year of Rankkw Pro at a locked-in price…" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginTop: 12 }}>
                <div><label style={label}>Price</label><input style={field} value={f.price || ''} onChange={e => set('price', e.target.value)} placeholder="$99.99" /></div>
                <div><label style={label}>Price note</label><input style={field} value={f.priceNote || ''} onChange={e => set('priceNote', e.target.value)} placeholder="per year · ~$7.50 / mo" /></div>
              </div>
              <label style={{ ...label, marginTop: 12 }}>Button label</label>
              <input style={field} value={f.ctaLabel || ''} onChange={e => set('ctaLabel', e.target.value)} placeholder="Learn more" />
              <label style={{ ...label, marginTop: 12 }}>Button link (Learn more → …)</label>
              <input style={field} value={f.ctaUrl || ''} onChange={e => set('ctaUrl', e.target.value)} placeholder="/deals/pro-1-year-plan" />
            </Card>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <label style={label}>Status</label>
            <button onClick={() => set('enabled', !f.enabled)} style={{ ...chip, width: '100%', textAlign: 'center', padding: '10px', background: f.enabled ? 'rgba(31,138,76,0.12)' : C.paper, color: f.enabled ? '#1F8A4C' : C.ink, borderColor: f.enabled ? '#1F8A4C' : C.ash }}>
              {f.enabled ? '● Live — showing to visitors' : 'Off — not shown'}
            </button>
            <p style={{ fontSize: 11.5, color: C.stone, marginTop: 8, lineHeight: 1.5 }}>Enabling this ad turns any other live ad off.</p>
          </Card>
          <Card>
            <label style={label}>Preview</label>
            <div style={{ background: C.canvas, borderRadius: 14, padding: 18, border: `1px solid ${C.hair}`, textAlign: 'center' }}>
              {isImage ? (
                f.imageUrl ? <img src={f.imageUrl} alt="preview" style={{ width: '100%', borderRadius: 10 }} /> : <p style={{ fontSize: 13, color: C.stone }}>Add an image URL to preview.</p>
              ) : (
                <div>
                  {f.badge && <span style={{ display: 'inline-block', fontSize: 10.5, fontFamily: MONO, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', background: C.orange, padding: '4px 11px', borderRadius: 100, marginBottom: 12 }}>{f.badge}</span>}
                  {f.title && <p style={{ fontSize: 18, fontWeight: 600, color: C.ink, marginBottom: 8 }}>{f.title}</p>}
                  {f.description && <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.55, marginBottom: 12 }}>{f.description}</p>}
                  {f.price && <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#FB5E09,#D8480B)', color: '#fff', padding: '9px 16px', borderRadius: 10, fontSize: 22, fontWeight: 700 }}>{f.price}</div>}
                  {f.priceNote && <p style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone, marginTop: 6 }}>{f.priceNote}</p>}
                  <div style={{ marginTop: 14 }}><span style={{ display: 'inline-block', background: C.orange, color: '#fff', fontSize: 14, fontWeight: 600, padding: '10px 22px', borderRadius: 100 }}>{f.ctaLabel || 'Learn more'} →</span></div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
