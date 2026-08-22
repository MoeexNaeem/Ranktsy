'use client'
import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C, D } from '@/utils'

/* Serialized run shape from /api/automation/runs/[id]. */
type Item = {
  idx: number; keyword: string; status: 'pending' | 'running' | 'done' | 'error'
  title: string | null; tags: string[]; description: string | null; price: number | null
  listingId: number | null; listingUrl: string | null; error: string | null
}
type Run = {
  id: string; status: string; total: number; done: number; errored: number
  publishToEtsy: boolean; items: Item[]
}
type Taxonomy = { id: number; name: string; fullPath: string; level: number }

const PIPE = ['Keyword', 'Market research', 'Title', '13 tags', 'Description', 'Price', 'Draft → Etsy']

const input: React.CSSProperties = { width: '100%', fontSize: 14, fontFamily: 'inherit', color: C.ink, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '10px 12px', outline: 'none' }
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }
const card: React.CSSProperties = { background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 16, padding: 20 }

function StatusDot({ s }: { s: Item['status'] }) {
  const map: Record<Item['status'], string> = { pending: C.stone, running: C.orange, done: D.good, error: D.hard }
  return <span style={{ width: 9, height: 9, borderRadius: '50%', background: map[s], flexShrink: 0, display: 'inline-block' }} />
}

export function AutomateClient() {
  const [mode, setMode] = useState<'keywords' | 'niche'>('niche')
  const [niche, setNiche] = useState('')
  const [seedsText, setSeedsText] = useState('')
  const [count, setCount] = useState('5')
  const [geo, setGeo] = useState('US')

  const [publishToEtsy, setPublishToEtsy] = useState(false)
  const [taxQuery, setTaxQuery] = useState('')
  const [taxonomyId, setTaxonomyId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [listingType, setListingType] = useState<'physical' | 'download'>('physical')
  const [whoMade, setWhoMade] = useState<'i_did' | 'someone_else'>('i_did')

  const [run, setRun] = useState<Run | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const stopRef = useRef(false)

  const { data: taxonomy } = useQuery({
    queryKey: ['etsy-taxonomy'],
    queryFn: async () => (await axios.get('/api/etsy/taxonomy')).data.data as Taxonomy[],
    staleTime: 1000 * 60 * 60,
    enabled: publishToEtsy,
  })
  const taxMatches = (taxonomy ?? []).filter(t => !taxQuery.trim() || t.fullPath.toLowerCase().includes(taxQuery.trim().toLowerCase())).slice(0, 60)

  const start = useCallback(async () => {
    setErr(''); setRun(null); stopRef.current = false
    if (publishToEtsy && !taxonomyId) { setErr('Pick a category to publish drafts.'); return }
    setBusy(true)
    try {
      const seeds = seedsText.split('\n').map(s => s.trim()).filter(Boolean)
      const { data } = await axios.post('/api/automation/runs', {
        mode,
        niche: mode === 'niche' ? niche : undefined,
        seeds: mode === 'keywords' ? seeds : undefined,
        count: Number(count) || 5,
        geo,
        publishToEtsy,
        taxonomyId: taxonomyId ? Number(taxonomyId) : undefined,
        quantity: Number(quantity) || 1,
        listingType, whoMade,
      })
      if (!data.success) { setErr(data.error || 'Could not start.'); setBusy(false); return }
      const id: string = data.data.id
      // Drive the run one product at a time until it finishes.
      let status = 'running'
      while (status === 'running' || status === 'pending') {
        if (stopRef.current) break
        const step = await axios.post(`/api/automation/runs/${id}/step`, {}).then(r => r.data).catch(() => null)
        if (!step?.success) { setErr(step?.error || 'A step failed.'); break }
        setRun(step.data as Run)
        status = step.data.status
        await new Promise(r => setTimeout(r, 250))
      }
    } catch (e) {
      setErr(axios.isAxiosError(e) ? (e.response?.data?.error as string) || 'Request failed.' : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }, [mode, niche, seedsText, count, geo, publishToEtsy, taxonomyId, quantity, listingType, whoMade])

  const stop = () => { stopRef.current = true }

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, padding: '32px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.orange, background: C.orangeFaint, padding: '4px 10px', borderRadius: 100, marginBottom: 10 }}>Hidden · admin only</div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em' }}>Automate Etsy Shop</h1>
          <p style={{ fontSize: 14, color: C.graphite, marginTop: 4, lineHeight: 1.55 }}>
            Generate a batch of SEO-optimized listings from real market data and push each to your shop as a draft, one by one.
          </p>
        </div>

        {/* Pipeline visualization (the "nodes" the run walks per product) */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {PIPE.map((n, i) => (
            <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.ink, background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '7px 13px' }}>{n}</span>
              {i < PIPE.length - 1 && <span style={{ color: C.stone }}>→</span>}
            </span>
          ))}
        </div>

        {/* Config */}
        <div style={{ ...card, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['niche', 'keywords'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${mode === m ? C.orange : C.ash}`, background: mode === m ? C.orangeFaint : C.paper, color: mode === m ? C.orange : C.graphite, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                {m === 'niche' ? 'From a niche (AI picks products)' : 'From my keywords (one per line)'}
              </button>
            ))}
          </div>

          {mode === 'niche' ? (
            <div>
              <label style={label}>Niche</label>
              <input value={niche} onChange={e => setNiche(e.target.value)} placeholder="e.g. minimalist nursery wall art" style={input} />
            </div>
          ) : (
            <div>
              <label style={label}>Keywords (one per line)</label>
              <textarea value={seedsText} onChange={e => setSeedsText(e.target.value)} rows={5} placeholder={'ceramic coffee mug\npersonalized dog bandana\nboho macrame keychain'} style={{ ...input, resize: 'vertical' }} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>How many products</label>
              <input value={count} onChange={e => setCount(e.target.value)} inputMode="numeric" style={input} />
            </div>
            <div>
              <label style={label}>Market (country)</label>
              <input value={geo} onChange={e => setGeo(e.target.value.toUpperCase().slice(0, 3))} style={input} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={publishToEtsy} onChange={e => setPublishToEtsy(e.target.checked)} />
            <span style={{ fontSize: 14, color: C.ink }}>Also create each as a <strong>draft</strong> in my connected Etsy shop</span>
          </label>

          {publishToEtsy && (
            <div style={{ display: 'grid', gap: 12, padding: 14, background: C.canvas, borderRadius: 12 }}>
              <div>
                <label style={label}>Category (all products)</label>
                <input value={taxQuery} onChange={e => setTaxQuery(e.target.value)} placeholder="Search categories, e.g. mug, wall art" style={{ ...input, marginBottom: 8 }} />
                <select value={taxonomyId} onChange={e => setTaxonomyId(e.target.value)} style={input}>
                  <option value="">Select a category</option>
                  {taxMatches.map(t => <option key={t.id} value={t.id}>{t.fullPath}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Type</label>
                  <select value={listingType} onChange={e => setListingType(e.target.value as 'physical' | 'download')} style={input}>
                    <option value="physical">Physical</option>
                    <option value="download">Digital</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Who made</label>
                  <select value={whoMade} onChange={e => setWhoMade(e.target.value as 'i_did' | 'someone_else')} style={input}>
                    <option value="i_did">I did</option>
                    <option value="someone_else">Another</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Quantity</label>
                  <input value={quantity} onChange={e => setQuantity(e.target.value)} inputMode="numeric" style={input} />
                </div>
              </div>
              <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.5 }}>Drafts only — they land in your Etsy Drafts to review and publish. Physical drafts need a shipping profile added on Etsy before they go live.</p>
            </div>
          )}

          {err && <p style={{ fontSize: 13.5, color: D.hard }}>{err}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={start} disabled={busy} style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 100, padding: '12px 26px', fontSize: 14.5, fontWeight: 600, cursor: busy ? 'progress' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Running…' : 'Start workflow'}
            </button>
            {busy && <button onClick={stop} style={{ background: 'none', border: `1px solid ${C.ash}`, borderRadius: 100, padding: '12px 22px', fontSize: 14, color: C.graphite, cursor: 'pointer', fontFamily: 'inherit' }}>Stop</button>}
          </div>
        </div>

        {/* Progress */}
        {run && (
          <div style={{ ...card }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>Progress</h2>
              <span style={{ fontSize: 13, color: C.graphite }}>{run.done}/{run.total} done{run.errored ? ` · ${run.errored} failed` : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {run.items.map(it => (
                <div key={it.idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 13px', background: C.canvas, borderRadius: 10 }}>
                  <span style={{ marginTop: 5 }}><StatusDot s={it.status} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{it.keyword}</span>
                      {it.price != null && <span style={{ fontSize: 12, color: D.good }}>${it.price}</span>}
                      {it.listingUrl && <a href={it.listingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.orange, fontWeight: 600 }}>Open draft on Etsy →</a>}
                    </div>
                    {it.title && <p style={{ fontSize: 12.5, color: C.graphite, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</p>}
                    {it.tags?.length > 0 && <p style={{ fontSize: 11.5, color: C.stone, marginTop: 3 }}>{it.tags.join(' · ')}</p>}
                    {it.error && <p style={{ fontSize: 12, color: D.hard, marginTop: 3 }}>{it.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
