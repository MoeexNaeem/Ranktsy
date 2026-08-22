'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, SectionTitle } from '../kit'
import { C, D } from '@/utils'

/**
 * "Send to Etsy" - pushes the generated listing to the seller's connected shop as
 * a DRAFT (never live). Collects the few fields Etsy requires that AI can't decide
 * for the seller (category, price, quantity, type, who made it), pre-filled where
 * possible, then POSTs to /api/etsy/create-listing.
 *
 * Requires a connected shop with the listings_w scope; if the shop was connected
 * before that scope existed, the API returns a "reconnect" message.
 */
type Taxonomy = { id: number; name: string; fullPath: string; level: number }

const selStyle: React.CSSProperties = {
  width: '100%', fontSize: 14, fontFamily: 'inherit', color: C.ink, background: C.paper,
  border: `1px solid ${C.ash}`, borderRadius: 10, padding: '9px 11px', outline: 'none',
}
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }

export function SendToEtsy({ title, description, tags, price }: {
  title: string; description: string; tags: string[]; price?: number | null
}) {
  const [open, setOpen] = useState(false)
  const [taxQuery, setTaxQuery] = useState('')
  const [taxonomyId, setTaxonomyId] = useState('')
  const [priceInput, setPriceInput] = useState(price != null ? String(price) : '')
  const [qty, setQty] = useState('1')
  const [type, setType] = useState<'physical' | 'download'>('physical')
  const [whoMade, setWhoMade] = useState<'i_did' | 'someone_else'>('i_did')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ url: string } | null>(null)
  const [error, setError] = useState('')

  const { data: taxonomy, isLoading: taxLoading } = useQuery({
    queryKey: ['etsy-taxonomy'],
    queryFn: async () => (await axios.get('/api/etsy/taxonomy')).data.data as Taxonomy[],
    staleTime: 1000 * 60 * 60,
    enabled: open,
  })
  const matches = (taxonomy ?? [])
    .filter(t => !taxQuery.trim() || t.fullPath.toLowerCase().includes(taxQuery.trim().toLowerCase()))
    .slice(0, 60)

  const submit = async () => {
    setError(''); setResult(null)
    const priceNum = parseFloat(priceInput)
    if (!taxonomyId) { setError('Pick a category.'); return }
    if (!priceNum || priceNum <= 0) { setError('Enter a valid price.'); return }
    setBusy(true)
    try {
      const { data } = await axios.post('/api/etsy/create-listing', {
        title, description, tags, price: priceNum,
        quantity: parseInt(qty, 10) || 1, taxonomyId: Number(taxonomyId), type, whoMade,
      })
      if (data.success && data.data) setResult({ url: data.data.url })
      else setError(data.error || 'Upload failed.')
    } catch (e) {
      const msg = axios.isAxiosError(e) ? (e.response?.data?.error as string) : ''
      setError(msg || 'Upload failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <SectionTitle right={
        !open && !result ? (
          <button onClick={() => setOpen(true)}
            style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 100, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Send to Etsy
          </button>
        ) : undefined
      }>Publish to your shop</SectionTitle>

      {!open && !result && (
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.55, marginTop: -6 }}>
          Push this listing straight to your connected Etsy shop as a <strong style={{ color: C.ink }}>draft</strong>.
          It lands in your Etsy Drafts to review and publish, nothing goes live automatically.
        </p>
      )}

      {result && (
        <div style={{ padding: '14px 16px', background: D.goodBg, borderRadius: 12 }}>
          <p style={{ fontSize: 14.5, fontWeight: 600, color: D.good, marginBottom: 4 }}>Draft created in your Etsy shop.</p>
          <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.55 }}>
            Review and publish it on Etsy.{' '}
            {result.url && <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ color: C.orange, fontWeight: 600 }}>Open the draft on Etsy</a>}
          </p>
          <button onClick={() => { setResult(null); setOpen(false) }} style={{ marginTop: 10, fontSize: 12.5, color: C.stone, background: 'none', border: 'none', cursor: 'pointer' }}>Done</button>
        </div>
      )}

      {open && !result && (
        <div style={{ display: 'grid', gap: 14, marginTop: 4 }}>
          {/* Category (taxonomy) */}
          <div>
            <label style={labelStyle}>Category</label>
            <input value={taxQuery} onChange={e => setTaxQuery(e.target.value)} placeholder="Search categories, e.g. mug, wall art, necklace"
              style={{ ...selStyle, marginBottom: 8 }} />
            <select value={taxonomyId} onChange={e => setTaxonomyId(e.target.value)} style={selStyle}>
              <option value="">{taxLoading ? 'Loading categories...' : 'Select a category'}</option>
              {matches.map(t => <option key={t.id} value={t.id}>{t.fullPath}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Price</label>
              <input value={priceInput} onChange={e => setPriceInput(e.target.value)} inputMode="decimal" placeholder="19.99" style={selStyle} />
            </div>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input value={qty} onChange={e => setQty(e.target.value)} inputMode="numeric" placeholder="1" style={selStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as 'physical' | 'download')} style={selStyle}>
                <option value="physical">Physical product</option>
                <option value="download">Digital download</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Who made it</label>
              <select value={whoMade} onChange={e => setWhoMade(e.target.value as 'i_did' | 'someone_else')} style={selStyle}>
                <option value="i_did">I did</option>
                <option value="someone_else">Another company or person</option>
              </select>
            </div>
          </div>

          {type === 'physical' && (
            <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.5 }}>
              Physical listings need a shipping profile before you can publish, add it when you review the draft on Etsy.
            </p>
          )}

          {error && <p style={{ fontSize: 13, color: D.hard, lineHeight: 1.5 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={submit} disabled={busy}
              style={{ background: C.orange, color: '#fff', border: 'none', borderRadius: 100, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: busy ? 'progress' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Uploading...' : 'Create draft on Etsy'}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy}
              style={{ background: 'none', border: 'none', color: C.stone, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  )
}
