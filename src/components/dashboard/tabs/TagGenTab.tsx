'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, SectionTitle, SearchBar, EmptyState, ErrorBox, MONO } from '../kit'
import { C, D } from '@/utils'
import type { AiTagResult } from '@/types'

let savedInput = ''
let savedSubmitted = ''

const COMP_COL: Record<string, string> = { low: D.good, medium: D.mid, high: D.hard }

function Tag({ text, primary }: { text: string; primary?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1000) }}
      title="Click to copy"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 100, padding: '9px 16px', cursor: 'pointer',
        fontSize: 15, fontFamily: 'inherit', fontWeight: 500,
        background: done ? D.goodBg : primary ? C.orange : C.orangeFaint,
        color: done ? D.good : primary ? '#fff' : C.orange,
        border: `1px solid ${done ? D.good : primary ? C.orange : 'transparent'}`,
      }}>
      {text}
      <span style={{ fontSize: 11, fontFamily: MONO, opacity: 0.7 }}>{text.length}</span>
    </button>
  )
}

export function TagGenTab() {
  const [input, setInput] = useState(savedInput)
  const [submitted, setSubmitted] = useState(savedSubmitted)
  const [copiedAll, setCopiedAll] = useState(false)

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['ai-tag', submitted],
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/ai/tag?q=${encodeURIComponent(submitted)}`, { signal })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.success) throw new Error(d?.error || 'Generation failed.')
      return d.data as AiTagResult
    },
    enabled: submitted.trim().length >= 2,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
  })

  const run = () => {
    const q = input.trim()
    if (q.length < 2) return
    savedInput = input; savedSubmitted = q
    setSubmitted(q)
  }

  const copyAll = () => {
    if (!data) return
    navigator.clipboard?.writeText(data.tags.join(', '))
    setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1400)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.stone }}>AI · grounded in real Google + Etsy data</span>}>
          Generate 13 Etsy tags
        </SectionTitle>
        <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.55, margin: '2px 0 12px' }}>
          Enter your focus keyword. Tags are ≤20 chars, unique, and prioritise low-competition, high-intent phrases — including ones the top live listings actually use.
        </p>
        <SearchBar value={input} onChange={v => { setInput(v); savedInput = v }} onSubmit={run} placeholder="e.g. boho earrings" button={isFetching ? 'Generating…' : 'Generate →'} />
      </Card>

      {isError && <ErrorBox>{(error as Error)?.message || 'Generation failed.'}</ErrorBox>}
      {isFetching && <Card><div className="shimmer" style={{ height: 180, borderRadius: 10, background: '#e8e7e2' }} /></Card>}
      {!isFetching && !data && !isError && <EmptyState icon="🏷" title="No tags yet" sub="Enter a focus keyword and hit Generate." />}

      {data && !isFetching && (
        <>
          <Card>
            <SectionTitle right={
              <button onClick={copyAll} style={{ border: `1px solid ${copiedAll ? D.good : C.ash}`, background: copiedAll ? D.goodBg : C.paper, color: copiedAll ? D.good : C.orange, borderRadius: 100, padding: '6px 15px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                {copiedAll ? 'Copied ✓' : `Copy all ${data.tags.length}`}
              </button>
            }>
              Recommended tags <span style={{ fontSize: 12, fontFamily: MONO, color: C.stone, fontWeight: 400 }}>({data.tags.length}/13)</span>
            </SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 6 }}>
              {data.tags.map(t => <Tag key={t} text={t} primary={t === data.primaryTag} />)}
            </div>
            <p style={{ fontSize: 12.5, color: C.stone, fontFamily: MONO, marginTop: 12 }}>Click any tag to copy it. Number = character count.</p>
          </Card>

          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, alignItems: 'start' }}>
            <Card>
              <SectionTitle>Tag strategy</SectionTitle>
              <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.65, marginTop: 4 }}>{data.strategy}</p>
              {(data.longTailTags?.length ?? 0) > 0 && (
                <>
                  <p style={{ fontSize: 12, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 7px' }}>Long-tail tags</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {data.longTailTags!.map(t => <Tag key={t} text={t} />)}
                  </div>
                </>
              )}
            </Card>
            <Card>
              <SectionTitle>Assessment</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: C.graphite }}>Overall competition</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COMP_COL[data.competition?.toLowerCase()] ?? C.ink }}>{data.competition}</span>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 14, color: C.graphite }}>Tag SEO score</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, fontFamily: MONO }}>{data.seoScore}/100</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 100, background: C.ash, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, data.seoScore))}%`, height: '100%', background: data.seoScore >= 75 ? D.good : data.seoScore >= 50 ? D.mid : D.hard }} />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Primary tag</p>
                  <Tag text={data.primaryTag} primary />
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
