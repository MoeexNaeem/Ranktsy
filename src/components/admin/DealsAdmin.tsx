'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { C } from '@/utils'
import { Card, SectionTitle, primaryBtn, MONO, tableCard, tableHead, th, tableRow, EmptyState } from '@/components/dashboard/kit'
import { Markdown } from '@/components/blog/Markdown'
import { slugifyTitle } from '@/lib/blog'

interface DealRow { _id: string; title: string; slug: string; status: 'draft' | 'published'; badge?: string; ctaLabel?: string; ctaPlan?: string; ctaUrl?: string; updatedAt?: string }

// Paid plan slugs an admin can attach a checkout CTA to (mirrors CHECKOUT_PLANS).
const PLAN_OPTIONS = ['', 'starter', 'basic', 'pro', 'pro-1yr', 'business', 'agency', 'enterprise']

const field: React.CSSProperties = { width: '100%', background: C.snow, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '10px 13px', fontSize: 14.5, fontFamily: 'inherit', color: C.ink, outline: 'none', boxSizing: 'border-box' }
const label: React.CSSProperties = { fontSize: 12, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'block' }
const chip: React.CSSProperties = { fontSize: 12.5, fontFamily: MONO, border: `1px solid ${C.ash}`, background: C.paper, borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: C.ink }

const GRID = '2.2fr 0.9fr 1fr 0.8fr 1.1fr'

export function DealsAdmin() {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [deals, setDeals] = useState<DealRow[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  // editor state
  const [id, setId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [badge, setBadge] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [ctaLabel, setCtaLabel] = useState('Get this deal')
  const [ctaPlan, setCtaPlan] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const { data } = await axios.get('/api/admin/deals')
      if (data?.success) setDeals(data.data.deals)
      else setErr(data?.error || 'Failed to load')
    } catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Failed to load') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setId(null); setTitle(''); setSlug(''); setSlugTouched(false); setBadge(''); setSummary('')
    setContent(''); setCtaLabel('Get this deal'); setCtaPlan(''); setCtaUrl(''); setStatus('draft'); setPreview(false)
  }
  const startNew = () => { resetForm(); setView('edit') }

  const startEdit = async (did: string) => {
    resetForm()
    try {
      const { data } = await axios.get(`/api/admin/deals/${did}`)
      if (!data?.success) throw new Error(data?.error || 'Not found')
      const d = data.data.deal
      setId(d._id); setTitle(d.title); setSlug(d.slug); setSlugTouched(true); setBadge(d.badge || '')
      setSummary(d.summary || ''); setContent(d.content || ''); setCtaLabel(d.ctaLabel || 'Get this deal')
      setCtaPlan(d.ctaPlan || ''); setCtaUrl(d.ctaUrl || ''); setStatus(d.status || 'draft'); setView('edit')
    } catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Failed to open') }
  }

  const onTitle = (v: string) => { setTitle(v); if (!slugTouched) setSlug(slugifyTitle(v)) }

  const insert = (before: string, after = '') => {
    const el = bodyRef.current; if (!el) { setContent(c => c + before + after); return }
    const s = el.selectionStart, e = el.selectionEnd
    const sel = content.slice(s, e)
    const next = content.slice(0, s) + before + sel + after + content.slice(e)
    setContent(next)
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + before.length + sel.length + after.length })
  }
  const insertLink = () => {
    const el = bodyRef.current
    const s = el?.selectionStart ?? content.length
    const e = el?.selectionEnd ?? content.length
    const selected = content.slice(s, e).trim()
    const text = selected || window.prompt('Link text:')?.trim() || ''
    if (!text) return
    let url = window.prompt('Paste the link URL:', 'https://')?.trim() || ''
    if (!url || url === 'https://') return
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('#')) url = `https://${url}`
    const md = `[${text}](${url})`
    setContent(content.slice(0, s) + md + content.slice(e))
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = s + md.length } })
  }

  const save = async (publish?: boolean) => {
    if (title.trim().length < 3) { setErr('Title must be at least 3 characters.'); return }
    setSaving(true); setErr('')
    const nextStatus = publish != null ? (publish ? 'published' : 'draft') : status
    const payload = { title, slug, badge, summary, content, ctaLabel, ctaPlan, ctaUrl, status: nextStatus }
    try {
      if (id) await axios.put(`/api/admin/deals/${id}`, payload)
      else await axios.post('/api/admin/deals', payload)
      await load(); setView('list'); resetForm()
    } catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Save failed') }
    finally { setSaving(false) }
  }

  const del = async (did: string) => {
    if (!window.confirm('Delete this deal permanently?')) return
    try { await axios.delete(`/api/admin/deals/${did}`); await load() }
    catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Delete failed') }
  }

  // ─── List view ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 24px 60px' }}>
        <SectionTitle right={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/admin" style={{ ...chip, textDecoration: 'none' }}>← Admin</Link>
            <button onClick={startNew} style={{ ...primaryBtn, height: 38 }}>+ New deal</button>
          </div>
        }>Deals</SectionTitle>

        {err && <p style={{ color: C.danger, fontSize: 13.5, marginBottom: 12 }}>{err}</p>}

        {loading ? (
          <div className="shimmer" style={{ height: 200, borderRadius: 14, background: '#e8e7e2' }} />
        ) : deals.length === 0 ? (
          <EmptyState icon="🎁" title="No deals yet" sub="Create your first promotional deal." />
        ) : (
          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>{['Title', 'Status', 'CTA', 'Badge', 'Actions'].map((h, i) => <span key={i} style={th}>{h}</span>)}</div>
            {deals.map(d => (
              <div key={d._id} style={tableRow(GRID)}>
                <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                <span><span style={{ fontSize: 11.5, fontFamily: MONO, padding: '3px 9px', borderRadius: 100, background: d.status === 'published' ? 'rgba(46,125,70,0.13)' : C.bone, color: d.status === 'published' ? '#2E7D46' : C.graphite }}>{d.status}</span></span>
                <span style={{ fontSize: 12.5, color: C.graphite, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.ctaPlan ? `plan: ${d.ctaPlan}` : d.ctaUrl ? 'url' : '—'}</span>
                <span style={{ fontSize: 13, color: C.graphite }}>{d.badge || '—'}</span>
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => startEdit(d._id)} style={chip}>Edit</button>
                  {d.status === 'published' && <a href={`/deals/${d.slug}`} target="_blank" rel="noreferrer" style={{ ...chip, textDecoration: 'none' }}>View</a>}
                  <button onClick={() => del(d._id)} style={{ ...chip, color: C.danger, borderColor: 'rgba(207,70,58,0.3)' }}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Editor view ───────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 24px 60px' }}>
      <SectionTitle right={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => { setView('list'); resetForm() }} style={chip}>← Back</button>
          <button onClick={() => save(false)} disabled={saving} style={{ ...chip, opacity: saving ? 0.6 : 1 }}>Save draft</button>
          <button onClick={() => save(true)} disabled={saving} style={{ ...primaryBtn, height: 38, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Publish'}</button>
        </div>
      }>{id ? 'Edit deal' : 'New deal'}</SectionTitle>

      {err && <p style={{ color: C.danger, fontSize: 13.5, marginBottom: 12 }}>{err}</p>}

      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <label style={label}>Title *</label>
            <input style={{ ...field, fontSize: 18, fontWeight: 500 }} value={title} onChange={e => onTitle(e.target.value)} placeholder="Pro · 1-Year — Best Value" />
            <div style={{ marginTop: 12 }}>
              <label style={label}>Slug — /deals/<span style={{ color: C.orange }}>{slug || 'your-deal'}</span></label>
              <input style={field} value={slug} onChange={e => { setSlugTouched(true); setSlug(slugifyTitle(e.target.value)) }} placeholder="pro-1-year-plan" />
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button onClick={() => insert('## ', '')} style={chip} title="Heading">H2</button>
                <button onClick={() => insert('### ', '')} style={chip} title="Subheading">H3</button>
                <button onClick={() => insert('**', '**')} style={chip} title="Bold">B</button>
                <button onClick={() => insert('*', '*')} style={chip} title="Italic"><em>i</em></button>
                <button onClick={() => insert('\n- ', '')} style={chip} title="List">• List</button>
                <button onClick={insertLink} style={chip} title="Select a word, then add a link">🔗 Link</button>
              </div>
              <button onClick={() => setPreview(p => !p)} style={{ ...chip, background: preview ? C.orangeFaint : C.paper, color: preview ? C.orange : C.ink }}>{preview ? 'Edit' : 'Preview'}</button>
            </div>
            {preview ? (
              <div style={{ background: C.canvas, borderRadius: 12, padding: '18px 20px', border: `1px solid ${C.hair}`, minHeight: 320 }}>
                {content.trim() ? <Markdown text={content} /> : <p style={{ color: C.stone, fontSize: 14 }}>Nothing to preview yet.</p>}
              </div>
            ) : (
              <textarea ref={bodyRef} value={content} onChange={e => setContent(e.target.value)}
                placeholder={'Describe the deal in Markdown.\n\n## What you get\n\n- Point one\n- Point two'}
                style={{ ...field, minHeight: 420, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 14, lineHeight: 1.6 }} />
            )}
            <p style={{ fontSize: 12, color: C.stone, marginTop: 8 }}>Markdown supported. Select a word and press <strong>🔗 Link</strong> to add a link.</p>
          </Card>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <label style={label}>Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['draft', 'published'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)} style={{ ...chip, flex: 1, textAlign: 'center', background: status === s ? C.orange : C.paper, color: status === s ? '#fff' : C.ink, borderColor: status === s ? C.orange : C.ash }}>{s}</button>
              ))}
            </div>
          </Card>
          <Card>
            <label style={label}>Badge (optional)</label>
            <input style={field} value={badge} onChange={e => setBadge(e.target.value)} placeholder="Best value" />
            <label style={{ ...label, marginTop: 12 }}>Card summary (optional)</label>
            <textarea style={{ ...field, minHeight: 72, resize: 'vertical' }} value={summary} onChange={e => setSummary(e.target.value)} placeholder="Auto-generated from the body if left blank." />
          </Card>
          <Card>
            <label style={label}>CTA button text</label>
            <input style={field} value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="Get 1-Year Plan" />
            <label style={{ ...label, marginTop: 12 }}>Checkout plan (Lemon Squeezy)</label>
            <select style={{ ...field, cursor: 'pointer' }} value={ctaPlan} onChange={e => setCtaPlan(e.target.value)}>
              {PLAN_OPTIONS.map(pl => <option key={pl} value={pl}>{pl || '— none (use URL below) —'}</option>)}
            </select>
            <label style={{ ...label, marginTop: 12 }}>…or direct URL (used only if no plan)</label>
            <input style={field} value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://…" />
            <p style={{ fontSize: 11.5, color: C.stone, marginTop: 8, lineHeight: 1.5 }}>Pick a plan to send buyers straight to Lemon Squeezy checkout. If no plan is set, the button links to the URL.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
