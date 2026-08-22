'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, SectionTitle, EmptyState, GenNote, GenSkeleton, TagPill, primaryBtn, MONO } from '../kit'
import { MiniMarkdown } from '../MiniMarkdown'
import { C, D } from '@/utils'
import { chargeCredits } from '@/lib/credits-client'
import { genFetch, busyRetry, busyRetryDelay, useWaitPhase } from '@/lib/ai/busy'
import type { AiDescResult } from '@/types'

interface DescParams { q: string; productName: string; productType: string; audience: string; features: string }
// Module-level memory so inputs + submitted params survive tab navigation.
const saved: DescParams & { submitted: DescParams | null } = { q: '', productName: '', productType: '', audience: '', features: '', submitted: null }

const field: React.CSSProperties = {
  width: '100%', background: C.snow, border: `1px solid ${C.ash}`, borderRadius: 10,
  padding: '11px 14px', fontSize: 15, fontFamily: 'inherit', color: C.ink, outline: 'none',
}
const label: React.CSSProperties = { fontSize: 12, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5, display: 'block' }

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
  const [active, setActive] = useState(0) // which of the 3 versions is shown

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['ai-desc', submitted ? JSON.stringify(submitted) : ''],
    queryFn: ({ signal }) => genFetch<AiDescResult[]>('/api/ai/description', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify(submitted),
    }),
    enabled: !!submitted && submitted.q.trim().length >= 2,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: busyRetry,
    retryDelay: busyRetryDelay,
  })
  const phase = useWaitPhase(isFetching)

  const run = async () => {
    if (q.trim().length < 2) return
    if (!(await chargeCredits('descgen'))) return
    const params: DescParams = { q: q.trim(), productName, productType, audience, features }
    Object.assign(saved, params, { submitted: params })
    setSubmitted(params)
    setActive(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.stone }}>AI · grounded in real data</span>}>
          Generate an Etsy description
        </SectionTitle>
        <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.55, margin: '2px 0 14px' }}>
          Enter your focus keyword. The extra fields are optional - leave them blank and the AI infers sensible details.
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
          <div style={{ gridColumn: '1 / -1' }}><label style={label}>Key features</label><textarea style={{ ...field, resize: 'vertical', minHeight: 62 }} rows={2} value={features} onChange={e => { setFeatures(e.target.value); saved.features = e.target.value }} placeholder="optional - e.g. editable in Canva, instant download, A4 + US Letter" /></div>
        </div>
        <button onClick={run} disabled={isFetching || q.trim().length < 2}
          style={{ ...primaryBtn, marginTop: 14, opacity: isFetching || q.trim().length < 2 ? 0.6 : 1, cursor: isFetching || q.trim().length < 2 ? 'not-allowed' : 'pointer' }}>
          {isFetching ? 'Generating 3 versions…' : 'Generate 3 descriptions →'}
        </button>
      </Card>

      {isFetching && <GenNote phase={phase} onRetry={() => refetch()} />}
      {isFetching && <GenSkeleton height={320} />}
      {isError && !isFetching && <GenNote phase="normal" error onRetry={() => refetch()} />}
      {!isFetching && !data && !isError && <EmptyState icon="📝" title="No description yet" sub="Fill in your keyword and hit Generate - you'll get 3 versions to choose from." />}

      {data && data.length > 0 && !isFetching && (() => {
        const cur = data[Math.min(active, data.length - 1)]
        const idx = Math.min(active, data.length - 1)
        return (
          <>
            <Card>
              <SectionTitle right={
                <button onClick={() => { navigator.clipboard?.writeText(cur.description); setCopied(true); setTimeout(() => setCopied(false), 1400) }}
                  style={{ border: `1px solid ${copied ? D.good : C.ash}`, background: copied ? D.goodBg : C.paper, color: copied ? D.good : C.orange, borderRadius: 100, padding: '6px 15px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {copied ? 'Copied ✓' : 'Copy description'}
                </button>
              }>
                Etsy description
              </SectionTitle>

              {/* Version switcher - one tab per generated variant */}
              {data.length > 1 && (
                <div style={{ display: 'flex', gap: 8, margin: '4px 0 14px', flexWrap: 'wrap' }}>
                  {data.map((_, i) => (
                    <button key={i} onClick={() => { setActive(i); setCopied(false) }}
                      style={{
                        padding: '7px 16px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                        border: `1px solid ${idx === i ? C.orange : C.ash}`,
                        background: idx === i ? C.orange : C.paper,
                        color: idx === i ? '#fff' : C.graphite,
                      }}>
                      Version {i + 1}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ background: C.canvas, borderRadius: 12, padding: '20px 22px', border: `1px solid ${C.hair}` }}>
                <MiniMarkdown text={cur.description} />
              </div>
            </Card>

            <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
              <Card>
                <SectionTitle>Scores{data.length > 1 ? ` · Version ${idx + 1}` : ''}</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
                  <ScoreBar label="SEO optimization" value={cur.seoScore} />
                  <ScoreBar label="Readability" value={cur.readabilityScore} />
                  <ScoreBar label="Conversion" value={cur.conversionScore} />
                </div>
              </Card>
              <Card>
                <SectionTitle>Keywords used</SectionTitle>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {[...(cur.secondaryKeywords ?? []), ...(cur.longTailKeywords ?? []), ...(cur.semanticKeywords ?? [])].slice(0, 24).map((k, i) => <TagPill key={k + i}>{k}</TagPill>)}
                </div>
              </Card>
            </div>
          </>
        )
      })()}
    </div>
  )
}
