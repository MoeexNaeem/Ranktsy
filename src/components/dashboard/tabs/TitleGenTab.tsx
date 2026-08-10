'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, SectionTitle, SearchBar, EmptyState, ErrorBox, MONO } from '../kit'
import { C, D } from '@/utils'
import { chargeCredits } from '@/lib/credits-client'
import type { AiTitleResult, AiTitleItem } from '@/types'

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-block', background: C.orangeFaint, color: C.orange, borderRadius: 100, padding: '9px 16px', fontSize: 15, fontWeight: 500, lineHeight: 1.2 }}>
      {children}
    </span>
  )
}

// Module-level memory — survives tab unmount so results persist across navigation
// (React Query caches the data; these remember what was typed/submitted).
let savedInput = ''
let savedSubmitted = ''

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200) }}
      style={{ border: `1px solid ${done ? D.good : C.ash}`, background: done ? D.goodBg : C.paper, color: done ? D.good : C.orange, borderRadius: 100, padding: '6px 15px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {done ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

function Score({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const good = invert ? value <= 20 : value >= 75
  const bad = invert ? value >= 50 : value < 45
  const col = good ? D.good : bad ? D.hard : D.mid
  return (
    <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>
      {label} <strong style={{ color: col }}>{value}</strong>
    </span>
  )
}

function TitleRow({ t, rank, best }: { t: AiTitleItem; rank: number; best?: boolean }) {
  return (
    <div style={{ padding: '16px 18px', borderRadius: 12, background: best ? C.orangeFaint : C.canvas, border: best ? `1px solid ${C.orange}` : `1px solid ${C.hair}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={{ fontSize: 12.5, fontFamily: MONO, color: best ? C.orange : C.stone, fontWeight: 600, marginTop: 3, minWidth: 42 }}>
          {best ? 'BEST' : `#${rank}`}
        </span>
        <p style={{ flex: 1, fontSize: 16.5, color: C.ink, lineHeight: 1.55, fontWeight: 450 }}>{t.title}</p>
        <span style={{ fontSize: 13, fontFamily: MONO, color: t.charCount >= 120 && t.charCount <= 140 ? D.good : D.mid, minWidth: 38, textAlign: 'right', marginTop: 3 }}>{t.charCount}</span>
        <CopyBtn text={t.title} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 16px', paddingLeft: 56 }}>
        <Score label="SEO" value={t.seoStrength} />
        <Score label="CTR" value={t.ctrPotential} />
        <Score label="Read" value={t.readabilityScore} />
        <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>Intent <strong style={{ color: C.ink }}>{t.buyerIntent}</strong></span>
      </div>
    </div>
  )
}

export function TitleGenTab() {
  const [input, setInput] = useState(savedInput)
  const [submitted, setSubmitted] = useState(savedSubmitted)

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['ai-title', submitted],
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/ai/title?q=${encodeURIComponent(submitted)}`, { signal })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.success) throw new Error(d?.error || 'Generation failed.')
      return d.data as AiTitleResult
    },
    enabled: submitted.trim().length >= 2,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
  })

  const run = async () => {
    const q = input.trim()
    if (q.length < 2) return
    if (!(await chargeCredits('titlegen'))) return
    savedInput = input; savedSubmitted = q
    setSubmitted(q)
  }

  const best = data?.best?.index ?? -1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.stone }}>AI · grounded in real Google + Etsy data</span>}>
          Generate 10 Etsy titles
        </SectionTitle>
        <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.55, margin: '2px 0 12px' }}>
          Enter your focus keyword. Titles are 120–140 chars, start with your keyword, and use low-competition keywords from real search data — never invented metrics.
        </p>
        <SearchBar value={input} onChange={v => { setInput(v); savedInput = v }} onSubmit={run} placeholder="e.g. boho earrings" button={isFetching ? 'Generating…' : 'Generate →'} />
      </Card>

      {isError && <ErrorBox>{(error as Error)?.message || 'Generation failed.'}</ErrorBox>}
      {isFetching && <Card><div className="shimmer" style={{ height: 260, borderRadius: 10, background: '#e8e7e2' }} /></Card>}
      {!isFetching && !data && !isError && <EmptyState icon="✨" title="No titles yet" sub="Enter a focus keyword and hit Generate." />}

      {data && !isFetching && (
        <>
          <Card>
            <SectionTitle>Suggested titles <span style={{ fontSize: 12, fontFamily: MONO, color: C.stone, fontWeight: 400 }}>({data.titles.length})</span></SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {best >= 0 && data.titles[best] && <TitleRow t={data.titles[best]} rank={best + 1} best />}
              {data.titles.map((t, i) => i === best ? null : <TitleRow key={i} t={t} rank={i + 1} />)}
            </div>
            {data.best?.reason && (
              <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.6, marginTop: 12, background: C.bone, borderRadius: 10, padding: '12px 14px' }}>
                <strong style={{ color: C.ink }}>Why the best title wins:</strong> {data.best.reason}
              </p>
            )}
          </Card>

          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card>
              <SectionTitle>Alternative low-KD keywords</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 8 }}>
                {(data.altKeywords ?? []).map(k => <Chip key={k}>{k}</Chip>)}
              </div>
            </Card>
            <Card>
              <SectionTitle>Long-tail variations</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 8 }}>
                {(data.longTailVariations ?? []).map(k => <Chip key={k}>{k}</Chip>)}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
