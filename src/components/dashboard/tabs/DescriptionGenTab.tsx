'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, SectionTitle, EmptyState, ErrorBox, TagPill, primaryBtn, MONO } from '../kit'
import { C, D } from '@/utils'
import type { AiDescResult } from '@/types'

interface DescParams { q: string; productName: string; productType: string; audience: string; features: string }
// Module-level memory so inputs + submitted params survive tab navigation.
const saved: DescParams & { submitted: DescParams | null } = { q: '', productName: '', productType: '', audience: '', features: '', submitted: null }

const field: React.CSSProperties = {
  width: '100%', background: C.snow, border: `1px solid ${C.ash}`, borderRadius: 10,
  padding: '11px 14px', fontSize: 15, fontFamily: 'inherit', color: C.ink, outline: 'none',
}
const label: React.CSSProperties = { fontSize: 12, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'block' }

function bold(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i} style={{ color: C.ink }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)
}
function MiniMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const out: React.ReactNode[] = []
  lines.forEach((ln, i) => {
    const t = ln.trim()
    if (!t) { out.push(<div key={i} style={{ height: 9 }} />); return }
    if (/^#{1,6}\s/.test(t)) {
      out.push(<h3 key={i} style={{ fontSize: 18.5, fontWeight: 600, color: C.ink, margin: '16px 0 6px', letterSpacing: '-0.01em' }}>{bold(t.replace(/^#{1,6}\s/, ''))}</h3>)
    } else if (/^(-|•|\*)\s/.test(t)) {
      out.push(<div key={i} style={{ display: 'flex', gap: 9, paddingLeft: 4, margin: '3px 0' }}><span style={{ color: C.orange }}>•</span><span style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.6 }}>{bold(t.replace(/^(-|•|\*)\s/, ''))}</span></div>)
    } else if (/^\d+\.\s/.test(t)) {
      const m = t.match(/^(\d+)\.\s(.*)/)!
      out.push(<div key={i} style={{ display: 'flex', gap: 9, paddingLeft: 4, margin: '3px 0' }}><span style={{ color: C.orange, fontFamily: MONO, fontSize: 14, minWidth: 18 }}>{m[1]}.</span><span style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.6 }}>{bold(m[2])}</span></div>)
    } else {
      out.push(<p key={i} style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.65, margin: '5px 0' }}>{bold(t)}</p>)
    }
  })
  return <div>{out}</div>
}

function ScoreBar({ label: l, value }: { label: string; value: number }) {
  const col = value >= 75 ? D.good : value >= 50 ? D.mid : D.hard
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13.5, color: C.graphite }}>{l}</span>
        <span style={{ fontSize: 13.5, fontFamily: MONO, fontWeight: 600, color: C.ink }}>{value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 100, background: C.ash, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', background: col }} />
      </div>
    </div>
  )
}

export function DescriptionGenTab() {
  const [q, setQ] = useState(saved.q)
  const [productName, setProductName] = useState(saved.productName)
  const [productType, setProductType] = useState(saved.productType)
  const [audience, setAudience] = useState(saved.audience)
  const [features, setFeatures] = useState(saved.features)
  const [submitted, setSubmitted] = useState<DescParams | null>(saved.submitted)
  const [copied, setCopied] = useState(false)

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['ai-desc', submitted ? JSON.stringify(submitted) : ''],
    queryFn: async ({ signal }) => {
      const r = await fetch('/api/ai/description', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify(submitted),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.success) throw new Error(d?.error || 'Generation failed.')
      return d.data as AiDescResult
    },
    enabled: !!submitted && submitted.q.trim().length >= 2,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
  })

  const run = () => {
    if (q.trim().length < 2) return
    const params: DescParams = { q: q.trim(), productName, productType, audience, features }
    Object.assign(saved, params, { submitted: params })
    setSubmitted(params)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.stone }}>AI · grounded in real Google + Etsy data</span>}>
          Generate an Etsy description
        </SectionTitle>
        <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.55, margin: '2px 0 14px' }}>
          Enter your focus keyword. The extra fields are optional — leave them blank and the AI infers sensible details.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={label}>Focus keyword *</label><input style={field} value={q} onChange={e => { setQ(e.target.value); saved.q = e.target.value }} placeholder="e.g. wedding invitation template" /></div>
          <div><label style={label}>Product name</label><input style={field} value={productName} onChange={e => { setProductName(e.target.value); saved.productName = e.target.value }} placeholder="optional" /></div>
          <div>
            <label style={label}>Product type</label>
            <select style={{ ...field, cursor: 'pointer' }} value={productType} onChange={e => { setProductType(e.target.value); saved.productType = e.target.value }}>
              <option value="">Auto-detect</option>
              <option value="Digital Product">Digital Product</option>
              <option value="Physical Product">Physical Product</option>
            </select>
          </div>
          <div><label style={label}>Target audience</label><input style={field} value={audience} onChange={e => { setAudience(e.target.value); saved.audience = e.target.value }} placeholder="optional" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={label}>Key features</label><textarea style={{ ...field, resize: 'vertical', minHeight: 62 }} rows={2} value={features} onChange={e => { setFeatures(e.target.value); saved.features = e.target.value }} placeholder="optional — e.g. editable in Canva, instant download, A4 + US Letter" /></div>
        </div>
        <button onClick={run} disabled={isFetching || q.trim().length < 2}
          style={{ ...primaryBtn, marginTop: 14, opacity: isFetching || q.trim().length < 2 ? 0.6 : 1, cursor: isFetching || q.trim().length < 2 ? 'not-allowed' : 'pointer' }}>
          {isFetching ? 'Generating…' : 'Generate description →'}
        </button>
      </Card>

      {isError && <ErrorBox>{(error as Error)?.message || 'Generation failed.'}</ErrorBox>}
      {isFetching && <Card><div className="shimmer" style={{ height: 320, borderRadius: 10, background: '#e8e7e2' }} /></Card>}
      {!isFetching && !data && !isError && <EmptyState icon="📝" title="No description yet" sub="Fill in your keyword and hit Generate." />}

      {data && !isFetching && (
        <>
          <Card>
            <SectionTitle right={
              <button onClick={() => { navigator.clipboard?.writeText(data.description); setCopied(true); setTimeout(() => setCopied(false), 1400) }}
                style={{ border: `1px solid ${copied ? D.good : C.ash}`, background: copied ? D.goodBg : C.paper, color: copied ? D.good : C.orange, borderRadius: 100, padding: '6px 15px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                {copied ? 'Copied ✓' : 'Copy description'}
              </button>
            }>
              Etsy description
            </SectionTitle>
            <div style={{ marginTop: 8, background: C.canvas, borderRadius: 12, padding: '20px 22px', border: `1px solid ${C.hair}` }}>
              <MiniMarkdown text={data.description} />
            </div>
          </Card>

          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
            <Card>
              <SectionTitle>Scores</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
                <ScoreBar label="SEO optimization" value={data.seoScore} />
                <ScoreBar label="Readability" value={data.readabilityScore} />
                <ScoreBar label="Conversion" value={data.conversionScore} />
              </div>
            </Card>
            <Card>
              <SectionTitle>Keywords used</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {[...(data.secondaryKeywords ?? []), ...(data.longTailKeywords ?? []), ...(data.semanticKeywords ?? [])].slice(0, 24).map((k, i) => <TagPill key={k + i}>{k}</TagPill>)}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
