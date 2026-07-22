'use client'
/**
 * Reusable AI Insights panel — the shared "AI analysis" surface for every tool.
 * Give it a subject + the REAL facts the tool has already measured; it asks
 * Gemini (via /api/ai/insights) to interpret them into a narrative read and
 * concrete actions. Gemini interprets the numbers, it never invents them — so
 * every figure shown was real before the model saw it.
 *
 * Usage:
 *   <AiInsights tool="Monthly Trends" subject={query} facts={facts} notes={...} />
 */
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { C } from '@/utils'
import { Card, MONO, primaryBtn } from './kit'
import type { ApiResponse, AiInsightsResult, AiFact, InsightTone } from '@/types'

const TONE: Record<InsightTone, { fg: string; bg: string; icon: string }> = {
  positive: { fg: '#16A34A', bg: 'rgba(22,163,74,0.10)',  icon: '↑' },
  watch:    { fg: '#C07A12', bg: 'rgba(224,160,40,0.14)', icon: '!' },
  neutral:  { fg: '#5B6472', bg: 'rgba(91,100,114,0.10)', icon: '•' },
}

export function AiInsights({ tool, subject, facts, notes }: {
  tool: string; subject: string; facts: AiFact[]; notes?: string
}) {
  const gen = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post<ApiResponse<AiInsightsResult>>('/api/ai/insights', { tool, subject, facts, notes })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
  })
  const r = gen.data
  const enoughData = facts.length >= 2

  return (
    <Card style={{ borderColor: 'var(--accent, #FB5E09)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: r ? 16 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft, rgba(251,94,9,0.12))', color: 'var(--accent, #FB5E09)', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.8L18.5 9l-4.6 1.2L12 15l-1.9-4.8L5.5 9l4.6-1.2z"/><path d="M18 14l.8 2 2 .8-2 .8L18 20l-.8-2-2-.8 2-.8z"/></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em' }}>AI Analysis</h3>
            <p style={{ fontSize: 12, color: C.graphite }}>Gemini reads the real numbers above — it interprets, never invents.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {r && (
            <span style={{ fontSize: 10.5, fontFamily: MONO, fontWeight: 600, letterSpacing: '0.05em', color: r.ai ? 'var(--accent, #FB5E09)' : C.graphite, background: r.ai ? 'var(--accent-soft, rgba(251,94,9,0.12))' : C.bone, padding: '4px 10px', borderRadius: 100 }}>
              {r.ai ? 'AI · GEMINI' : 'RULE-BASED'}
            </span>
          )}
          <button onClick={() => gen.mutate()} disabled={gen.isPending || !enoughData}
            style={{ ...primaryBtn, height: 40, padding: '0 18px', fontSize: 14, opacity: gen.isPending || !enoughData ? 0.55 : 1, cursor: gen.isPending || !enoughData ? 'default' : 'pointer' }}>
            {gen.isPending ? 'Analyzing…' : r ? 'Regenerate ↻' : '✦ Analyze'}
          </button>
        </div>
      </div>

      {gen.isError && (
        <p style={{ marginTop: 14, fontSize: 13.5, color: C.danger }}>Couldn&apos;t generate analysis. Please try again.</p>
      )}

      {r && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Headline */}
          <p style={{ fontSize: 15.5, fontWeight: 500, color: C.ink, lineHeight: 1.5, background: 'var(--accent-soft, rgba(251,94,9,0.12))', padding: '13px 15px', borderRadius: 12 }}>
            {r.headline}
          </p>

          {/* Insights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {r.insights.map((ins, i) => {
              const t = TONE[ins.tone]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 14px', border: `1px solid ${C.hair}`, borderRadius: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 7, background: t.bg, color: t.fg, fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{ins.title}</p>
                    <p style={{ fontSize: 13.5, color: C.graphite, marginTop: 3, lineHeight: 1.5 }}>{ins.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          {r.actions.length > 0 && (
            <div>
              <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9 }}>Recommended actions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {r.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--accent, #FB5E09)', fontWeight: 700, flexShrink: 0 }}>→</span>
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
