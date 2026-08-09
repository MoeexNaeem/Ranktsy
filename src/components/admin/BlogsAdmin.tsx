'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { C } from '@/utils'
import { Card, SectionTitle, primaryBtn, MONO, tableCard, tableHead, th, tableRow, EmptyState } from '@/components/dashboard/kit'
import { Markdown } from '@/components/blog/Markdown'
import { slugifyTitle } from '@/lib/blog'

interface PostRow { _id: string; title: string; slug: string; status: 'draft' | 'published'; category?: string; tags?: string[]; readingMinutes?: number; updatedAt?: string }

/**
 * Clean text pasted from Word/Google Docs so it doesn't wreck the Markdown body:
 * normalise line endings, drop non-breaking spaces, straighten smart quotes,
 * turn tabs into spaces, strip trailing whitespace, and collapse runs of blank
 * lines to a single paragraph break.
 */
function normalizePastedText(t: string): string {
  return t
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\t/g, '  ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const field: React.CSSProperties = { width: '100%', background: C.snow, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '10px 13px', fontSize: 14.5, fontFamily: 'inherit', color: C.ink, outline: 'none' }
const label: React.CSSProperties = { fontSize: 12, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'block' }
const chip: React.CSSProperties = { fontSize: 12.5, fontFamily: MONO, border: `1px solid ${C.ash}`, background: C.paper, borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: C.ink }

const GRID = '2.4fr 0.8fr 0.9fr 0.8fr 1.1fr'

export function BlogsAdmin() {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [posts, setPosts] = useState<PostRow[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  // editor state
  const [id, setId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [category, setCategory] = useState('General')
  const [tags, setTags] = useState('')
  const [cover, setCover] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const { data } = await axios.get('/api/admin/blogs')
      if (data?.success) setPosts(data.data.posts)
      else setErr(data?.error || 'Failed to load')
    } catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Failed to load') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setId(null); setTitle(''); setSlug(''); setSlugTouched(false); setCategory('General'); setTags('')
    setCover(''); setExcerpt(''); setContent(''); setSeoTitle(''); setSeoDesc(''); setStatus('draft'); setPreview(false)
  }
  const startNew = () => { resetForm(); setView('edit') }

  const startEdit = async (pid: string) => {
    resetForm()
    try {
      const { data } = await axios.get(`/api/admin/blogs/${pid}`)
      if (!data?.success) throw new Error(data?.error || 'Not found')
      const p = data.data.post
      setId(p._id); setTitle(p.title); setSlug(p.slug); setSlugTouched(true); setCategory(p.category || 'General')
      setTags((p.tags || []).join(', ')); setCover(p.coverImage || ''); setExcerpt(p.excerpt || ''); setContent(p.content || '')
      setSeoTitle(p.seoTitle || ''); setSeoDesc(p.seoDescription || ''); setStatus(p.status || 'draft'); setView('edit')
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
  const insertImage = () => {
    const url = window.prompt('Image URL (paste a hosted image link):')?.trim()
    if (!url) return
    const alt = window.prompt('Alt text / caption (for SEO & accessibility):')?.trim() || ''
    insert(`\n\n![${alt}](${url})\n\n`)
  }

  const save = async (publish?: boolean) => {
    if (title.trim().length < 3) { setErr('Title must be at least 3 characters.'); return }
    setSaving(true); setErr('')
    const nextStatus = publish != null ? (publish ? 'published' : 'draft') : status
    const payload = {
      title, slug, category, cover, excerpt, content, seoTitle, seoDescription: seoDesc, status: nextStatus,
      coverImage: cover, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }
    try {
      if (id) await axios.put(`/api/admin/blogs/${id}`, payload)
      else await axios.post('/api/admin/blogs', payload)
      await load(); setView('list'); resetForm()
    } catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Save failed') }
    finally { setSaving(false) }
  }

  const del = async (pid: string) => {
    if (!window.confirm('Delete this post permanently?')) return
    try { await axios.delete(`/api/admin/blogs/${pid}`); await load() }
    catch (e) { setErr(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : 'Delete failed') }
  }

  // ─── List view ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 24px 60px' }}>
        <SectionTitle right={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/admin" style={{ ...chip, textDecoration: 'none' }}>← Admin</Link>
            <button onClick={startNew} style={{ ...primaryBtn, height: 38 }}>+ New post</button>
          </div>
        }>Blog</SectionTitle>

        {err && <p style={{ color: C.danger, fontSize: 13.5, marginBottom: 12 }}>{err}</p>}

        {loading ? (
          <div className="shimmer" style={{ height: 200, borderRadius: 14, background: '#e8e7e2' }} />
        ) : posts.length === 0 ? (
          <EmptyState icon="📝" title="No posts yet" sub="Create your first Etsy SEO article." />
        ) : (
          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>{['Title', 'Status', 'Category', 'Read', 'Actions'].map((h, i) => <span key={i} style={th}>{h}</span>)}</div>
            {posts.map(p => (
              <div key={p._id} style={tableRow(GRID)}>
                <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <span><span style={{ fontSize: 11.5, fontFamily: MONO, padding: '3px 9px', borderRadius: 100, background: p.status === 'published' ? 'rgba(46,125,70,0.13)' : C.bone, color: p.status === 'published' ? '#2E7D46' : C.graphite }}>{p.status}</span></span>
                <span style={{ fontSize: 13, color: C.graphite }}>{p.category || 'General'}</span>
                <span style={{ fontSize: 13, fontFamily: MONO, color: C.graphite }}>{p.readingMinutes || 1}m</span>
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => startEdit(p._id)} style={chip}>Edit</button>
                  {p.status === 'published' && <a href={`/blogs/${p.slug}`} target="_blank" rel="noreferrer" style={{ ...chip, textDecoration: 'none' }}>View</a>}
                  <button onClick={() => del(p._id)} style={{ ...chip, color: C.danger, borderColor: 'rgba(207,70,58,0.3)' }}>Delete</button>
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
      }>{id ? 'Edit post' : 'New post'}</SectionTitle>

      {err && <p style={{ color: C.danger, fontSize: 13.5, marginBottom: 12 }}>{err}</p>}

      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <label style={label}>Title *</label>
            <input style={{ ...field, fontSize: 18, fontWeight: 500 }} value={title} onChange={e => onTitle(e.target.value)} placeholder="How keyword research grows your Etsy shop" />
            <div style={{ marginTop: 12 }}>
              <label style={label}>Slug — /blogs/<span style={{ color: C.orange }}>{slug || 'your-title'}</span></label>
              <input style={field} value={slug} onChange={e => { setSlugTouched(true); setSlug(slugifyTitle(e.target.value)) }} placeholder="how-keyword-research-grows-your-etsy-shop" />
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
                <button onClick={() => insert('\n> ', '')} style={chip} title="Quote">❝</button>
                <button onClick={() => insert('[', '](https://)')} style={chip} title="Link">Link</button>
                <button onClick={insertImage} style={{ ...chip, borderColor: C.orange, color: C.orange }} title="Insert image between sections">🖼 Image</button>
              </div>
              <button onClick={() => setPreview(p => !p)} style={{ ...chip, background: preview ? C.orangeFaint : C.paper, color: preview ? C.orange : C.ink }}>{preview ? 'Edit' : 'Preview'}</button>
            </div>
            {preview ? (
              <div style={{ background: C.canvas, borderRadius: 12, padding: '18px 20px', border: `1px solid ${C.hair}`, minHeight: 320 }}>
                {content.trim() ? <Markdown text={content} /> : <p style={{ color: C.stone, fontSize: 14 }}>Nothing to preview yet.</p>}
              </div>
            ) : (
              <textarea ref={bodyRef} value={content} onChange={e => setContent(e.target.value)}
                onPaste={e => {
                  const text = e.clipboardData.getData('text/plain')
                  if (!text) return
                  e.preventDefault()
                  const el = e.currentTarget
                  const s = el.selectionStart ?? content.length
                  const en = el.selectionEnd ?? content.length
                  const cleaned = normalizePastedText(text)
                  const next = content.slice(0, s) + cleaned + content.slice(en)
                  setContent(next)
                  requestAnimationFrame(() => { const pos = s + cleaned.length; el.selectionStart = el.selectionEnd = pos })
                }}
                placeholder={'Write in Markdown.\n\n## A section heading\n\nA paragraph of text. Use **bold**, *italic*, [links](https://example.com).\n\n![Alt text](https://image-url.jpg)\n\n- A bullet\n- Another bullet'}
                style={{ ...field, minHeight: 420, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 14, lineHeight: 1.6 }} />
            )}
            <p style={{ fontSize: 12, color: C.stone, marginTop: 8 }}>Markdown supported. Use <strong>🖼 Image</strong> to drop an image (by URL) between sections.</p>
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
            <label style={label}>Cover image URL</label>
            <input style={field} value={cover} onChange={e => setCover(e.target.value)} placeholder="https://…/cover.jpg" />
            {cover && <div style={{ marginTop: 10, aspectRatio: '16/9', borderRadius: 10, background: `#eee url(${cover}) center/cover` }} />}
          </Card>
          <Card>
            <label style={label}>Category</label>
            <input style={field} value={category} onChange={e => setCategory(e.target.value)} placeholder="Etsy SEO" />
            <label style={{ ...label, marginTop: 12 }}>Tags (comma separated)</label>
            <input style={field} value={tags} onChange={e => setTags(e.target.value)} placeholder="keywords, etsy, seo" />
            <label style={{ ...label, marginTop: 12 }}>Excerpt (optional)</label>
            <textarea style={{ ...field, minHeight: 64, resize: 'vertical' }} value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Auto-generated from the body if left blank." />
          </Card>
          <Card>
            <label style={label}>SEO title (optional)</label>
            <input style={field} value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="Overrides the page <title>" />
            <label style={{ ...label, marginTop: 12 }}>SEO description (optional)</label>
            <textarea style={{ ...field, minHeight: 64, resize: 'vertical' }} value={seoDesc} onChange={e => setSeoDesc(e.target.value)} placeholder="Overrides the meta description" />
          </Card>
        </div>
      </div>
    </div>
  )
}
