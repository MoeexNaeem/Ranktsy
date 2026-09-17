'use client'
import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Card, SectionTitle, GenNote, GenSkeleton, MONO, primaryBtn } from '../kit'
import { C } from '@/utils'
import { broadcastCredits } from '@/lib/credits-client'
import { triggerUpgrade } from '@/lib/upgrade'
import { busyRetry, busyRetryDelay, useWaitPhase } from '@/lib/ai/busy'
import { copyWithToast } from '@/components/ui/toast'
import { markdownToPlainText } from '@/lib/markdown-text'

interface Result {
  titles: string[]
  tags: string[]
  description: string
  altText: string
  ai: boolean
}

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => { copyWithToast(markdownToPlainText(text), 'Text'); setDone(true); setTimeout(() => setDone(false), 1200) }}
      style={{ fontSize: 12, fontFamily: MONO, color: done ? C.success : C.orange, background: 'transparent', border: `1px solid ${done ? C.success : C.orange}`, padding: '4px 12px', borderRadius: 100, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
      {done ? '✓ Copied' : label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 8,
  padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase',
  letterSpacing: '0.07em', color: '#6E6E64', marginBottom: 8,
}

export function AIListingHelperTab() {
  const [seed, setSeed] = useState('')
  const [details, setDetails] = useState('')

  const gen = useMutation({
    mutationFn: async () => {
      try {
        const { data } = await axios.post('/api/ai/listing', { seed, details })
        if (!data.success) throw new Error(data.error ?? 'Generation failed')
        if (data.state) broadcastCredits(data.state)   // charged server-side on success
        return data.data as Result
      } catch (e) {
        // Out of daily credits: refresh the pill and open the upgrade modal. Credits
        // are charged server-side only on success, so a failure costs nothing.
        if (axios.isAxiosError(e) && e.response?.status === 402 && e.response.data?.code === 'credit_limit') {
          const dd = e.response.data
          broadcastCredits(dd.state)
          triggerUpgrade({ title: 'You’re out of credits', message: dd.error || 'You’ve used all of today’s credits. Upgrade for a higher daily allowance.', plan: dd.plan })
        }
        throw e
      }
    },
    retry: busyRetry,
    retryDelay: busyRetryDelay,
  })

  const run = useCallback(() => {
    if (seed.trim().length < 2) return
    // Credits charged server-side, only on success (see withApiGuard tool:'aihelper').
    gen.mutate()
  }, [seed, gen])
  const r = gen.data
  const phase = useWaitPhase(gen.isPending)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Input card */}
      <Card>
        <SectionTitle right={
          <span style={{ fontSize: 10.5, fontFamily: MONO, color: '#9a9a92' }}>
            grounded in real listing tags
          </span>
        }>Describe your product</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Product</label>
            <input value={seed} onChange={e => setSeed(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') run() }}
              placeholder="e.g. personalized birthstone necklace for mom" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Extra details <span style={{ textTransform: 'none', color: '#b0b0a8' }}>(optional - material, occasion, style)</span></label>
            <input value={details} onChange={e => setDetails(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') run() }}
              placeholder="e.g. 925 sterling silver, minimalist, gift for new moms" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={run} disabled={seed.trim().length < 2 || gen.isPending} style={{ ...primaryBtn, opacity: seed.trim().length < 2 || gen.isPending ? 0.55 : 1 }}>
              {gen.isPending ? 'Generating…' : 'Generate listing'}
            </button>
          </div>
        </div>
      </Card>

      {gen.isPending && (
        <>
          <GenNote phase={phase} onRetry={() => gen.mutate()} />
          <GenSkeleton height={260} />
        </>
      )}
      {gen.isError && !gen.isPending && <GenNote phase="normal" error onRetry={() => gen.mutate()} />}

      {r && !gen.isPending && (
        <>
          {/* mode banner */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', fontSize: 11.5, fontFamily: MONO, padding: '5px 12px', borderRadius: 999, background: r.ai ? C.orangeFaint : C.bone, color: r.ai ? C.orange : '#6a6a62', border: `1px solid ${r.ai ? 'rgba(251,94,9,0.22)' : C.hair}` }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.ai ? C.orange : '#a9a79f', display: 'inline-block' }} />
            {r.ai ? 'Generated with AI' : 'Standard generation'}
          </div>

          {/* Titles */}
          <div>
            <SectionTitle>Title options <span style={{ fontSize: 11, fontFamily: MONO, color: '#808080', fontWeight: 400 }}>(≤140 chars)</span></SectionTitle>
            <Card pad={0}>
              {r.titles.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < r.titles.length - 1 ? `1px solid ${C.hair}` : 'none' }}>
                  <span style={{ flex: 1, fontSize: 13.5, color: C.ink, lineHeight: 1.4 }}>{t}</span>
                  <span style={{ fontSize: 11, fontFamily: MONO, color: t.length > 140 ? C.danger : '#a3a29a', flexShrink: 0 }}>{t.length}</span>
                  <CopyBtn text={t} />
                </div>
              ))}
            </Card>
          </div>

          {/* Tags */}
          <Card>
            <SectionTitle right={<CopyBtn text={r.tags.join(', ')} label={`Copy all ${r.tags.length}`} />}>Tags ({r.tags.length}/13)</SectionTitle>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {r.tags.map(t => (
                <button key={t} onClick={() => copyWithToast(t, 'Tag')} title="Click to copy"
                  style={{ fontSize: 12.5, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid rgba(251,94,9,0.22)`, padding: '5px 12px', borderRadius: 100, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.orange; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.orangeFaint; e.currentTarget.style.color = C.orange }}>
                  {t}
                </button>
              ))}
            </div>
          </Card>

          {/* Description */}
          <Card>
            <SectionTitle right={<CopyBtn text={r.description} />}>Description</SectionTitle>
            <p style={{ fontSize: 13.5, color: '#2f2f2f', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.description}</p>
          </Card>

          {/* Alt text */}
          {r.altText && (
            <Card>
              <SectionTitle right={<CopyBtn text={r.altText} />}>Image alt text</SectionTitle>
              <p style={{ fontSize: 13, color: '#6E6E64', lineHeight: 1.5 }}>{r.altText}</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

