'use client'
import { useMemo, useState } from 'react'
import { C } from '@/utils'
import { Card, MONO, SectionTitle } from '../kit'
import { AiInsights } from '../AiInsights'
import type { AiFact } from '@/types'

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) && n > 0 ? n : 0 }

function Field({ label, value, onChange, prefix, suffix }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6E6E64', marginBottom: 8 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 8, overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 2px 0 12px', fontSize: 13, color: '#808080', fontFamily: MONO }}>{prefix}</span>}
        <input type="number" min="0" step="any" inputMode="decimal" value={value} placeholder="0"
          onChange={e => onChange(e.target.value)}
          style={{ background: 'transparent', border: 'none', padding: '11px 10px', fontSize: 14, fontFamily: MONO, outline: 'none', flex: 1, color: '#1a1a1a', width: '100%', minWidth: 0 }} />
        {suffix && <span style={{ padding: '0 12px 0 2px', fontSize: 13, color: '#808080', fontFamily: MONO }}>{suffix}</span>}
      </div>
    </label>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card pad="14px 16px">
      <p style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 400, color: accent ?? C.ink, letterSpacing: '-0.6px', lineHeight: 1 }}>{value}</p>
    </Card>
  )
}

export function AdsRoiCalculatorTab() {
  const [spend, setSpend] = useState('50')
  const [impressions, setImpressions] = useState('8000')
  const [clicks, setClicks] = useState('240')
  const [orders, setOrders] = useState('12')
  const [aov, setAov] = useState('28')

  const r = useMemo(() => {
    const s = num(spend), imp = num(impressions), clk = num(clicks), ord = num(orders), v = num(aov)
    const ctr = imp > 0 ? (clk / imp) * 100 : 0
    const cpc = clk > 0 ? s / clk : 0
    const conv = clk > 0 ? (ord / clk) * 100 : 0
    const cpa = ord > 0 ? s / ord : 0
    const revenue = ord * v
    const roas = s > 0 ? revenue / s : 0
    const roi = s > 0 ? ((revenue - s) / s) * 100 : 0
    return { ctr, cpc, conv, cpa, revenue, roas, roi }
  }, [spend, impressions, clicks, orders, aov])

  const roiAccent = r.roi >= 0 ? C.success : C.danger

  // The seller's own campaign figures, for the AI coach. Gemini interprets them —
  // it doesn't invent numbers. Only meaningful once spend + clicks are entered.
  const aiFacts = useMemo<AiFact[]>(() => {
    if (num(spend) <= 0 || num(clicks) <= 0) return []
    return [
      { label: 'Ad spend', value: `$${num(spend).toFixed(2)}` },
      { label: 'ROAS', value: `${r.roas.toFixed(2)}×`, hint: 'revenue ÷ spend; 1.0× = break-even before product/fees' },
      { label: 'ROI', value: `${r.roi >= 0 ? '+' : ''}${r.roi.toFixed(0)}%` },
      { label: 'Revenue', value: `$${r.revenue.toFixed(2)}` },
      { label: 'CTR', value: `${r.ctr.toFixed(2)}%` },
      { label: 'CPC', value: `$${r.cpc.toFixed(2)}` },
      { label: 'Conversion rate', value: `${r.conv.toFixed(1)}%` },
      { label: 'Cost per order', value: `$${r.cpa.toFixed(2)}` },
    ]
  }, [spend, clicks, r])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 16, alignItems: 'start' }}>
        <Card pad="20px">
          <SectionTitle>Your Etsy Ads numbers</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Ad spend" value={spend} onChange={setSpend} prefix="$" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Impressions" value={impressions} onChange={setImpressions} />
              <Field label="Clicks" value={clicks} onChange={setClicks} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Orders" value={orders} onChange={setOrders} />
              <Field label="Avg order value" value={aov} onChange={setAov} prefix="$" />
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ROI highlight */}
          <div style={{ background: r.roi >= 0 ? C.successBg : C.dangerBg, borderRadius: 8, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, fontFamily: MONO, color: roiAccent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Return on ad spend</p>
              <p style={{ fontSize: 34, fontWeight: 500, color: roiAccent, letterSpacing: '-1px', lineHeight: 1.05 }}>{r.roas.toFixed(2)}×</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, fontFamily: MONO, color: roiAccent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ROI</p>
              <p style={{ fontSize: 26, fontWeight: 500, color: roiAccent, letterSpacing: '-0.5px' }}>{r.roi >= 0 ? '+' : ''}{r.roi.toFixed(0)}%</p>
            </div>
          </div>
          <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Metric label="Revenue" value={`$${r.revenue.toFixed(2)}`} accent={C.orange} />
            <Metric label="CTR" value={`${r.ctr.toFixed(2)}%`} />
            <Metric label="CPC" value={`$${r.cpc.toFixed(2)}`} />
            <Metric label="Conv. rate" value={`${r.conv.toFixed(1)}%`} />
            <Metric label="Cost / order" value={`$${r.cpa.toFixed(2)}`} />
            <Metric label="Break-even ROAS" value="1.00×" />
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#808080', lineHeight: 1.5 }}>
        A ROAS above <strong style={{ color: C.ink }}>1.0×</strong> means ads earn back more than they cost (before product/fee costs). Pair with the Fee Calculator to find your true profit-positive ROAS target.
      </p>

      {/* AI coaching on the campaign. */}
      {aiFacts.length >= 2 && (
        <AiInsights
          tool="Ads ROI"
          subject="your Etsy Ads campaign"
          facts={aiFacts}
          notes="These are the seller's OWN entered campaign figures (not Etsy-published analytics). Judge whether the campaign is profitable and efficient — remember ROAS 1.0× is only break-even before product and Etsy fees, so the real target is higher. For context, Etsy Ads CTR is often ~0.3–1.5% and conversion ~1–3%, but judge against this campaign's own break-even. Give specific levers (CTR, conversion, CPC, AOV) to improve ROAS. Do not invent the seller's numbers."
        />
      )}
    </div>
  )
}
