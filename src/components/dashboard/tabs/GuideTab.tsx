'use client'
/**
 * Rankkw Guide: the illustrated, step-by-step PDF for every tool (public/guide),
 * shown inside the dashboard. Phones often can't display a PDF inside a page, so
 * "Open guide" and "Download" are always offered next to it.
 */
import { C } from '@/utils'
import { Card } from '../kit'

const GUIDE_URL = '/guide/rankkw-guide.pdf'

const btn = (primary: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 100,
  fontSize: 14, fontWeight: 600, fontFamily: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap',
  background: primary ? C.orange : C.paper, color: primary ? '#fff' : C.ink,
  border: `1px solid ${primary ? C.orange : C.ash}`,
})

export function GuideTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em', marginBottom: 6 }}>The complete Rankkw guide</h2>
            <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.55 }}>
              Every tool explained in simple words: what it does, how to use it step by step, and what you get, with a real
              screenshot of each screen. 35 tools, 62 pages.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={GUIDE_URL} target="_blank" rel="noopener" style={btn(true)}>Open guide</a>
            <a href={GUIDE_URL} download="Rankkw-Guide.pdf" style={btn(false)}>Download PDF</a>
          </div>
        </div>
      </Card>

      <div style={{ background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 16, overflow: 'hidden' }}>
        <iframe src={`${GUIDE_URL}#view=FitH`} title="Rankkw Guide"
          style={{ display: 'block', width: '100%', height: 'min(82vh, 1100px)', border: 'none', background: C.canvas }} />
      </div>
      <p style={{ fontSize: 12.5, color: C.stone, textAlign: 'center' }}>
        Guide not showing above (common on phones)? Tap &ldquo;Open guide&rdquo; to read it full screen.
      </p>
    </div>
  )
}
