'use client'
import { useMemo, useState } from 'react'
import { C } from '@/utils'
import { Card, MONO, SectionTitle } from '../kit'

/**
 * Etsy Fee Calculator — estimates Etsy's seller fees, net profit and margin.
 * Fee rates reflect Etsy's public fee schedule (subject to change by Etsy):
 *   • Listing fee:            $0.20 per item listed/sold
 *   • Transaction fee:        6.5% of (item price + shipping charged)
 *   • Payment processing:     country-based % + flat (approximate)
 *   • Offsite Ads (optional): 15% of the order total
 * These are estimates only — always confirm current rates with Etsy.
 */

const LISTING_FEE = 0.20
const TRANSACTION_RATE = 0.065
const OFFSITE_ADS_RATE = 0.15

// Payment-processing fee presets by seller region (approximate; Etsy sets these
// per country and updates them over time). Each carries its own currency symbol.
const PROCESSING: Record<string, { label: string; rate: number; flat: number; cur: string }> = {
  US: { label: 'United States',  rate: 0.03, flat: 0.25, cur: '$' },
  GB: { label: 'United Kingdom',  rate: 0.04, flat: 0.20, cur: '£' },
  EU: { label: 'Eurozone (EU)',   rate: 0.04, flat: 0.30, cur: '€' },
  CA: { label: 'Canada',          rate: 0.03, flat: 0.25, cur: 'C$' },
  AU: { label: 'Australia',       rate: 0.03, flat: 0.25, cur: 'A$' },
  NZ: { label: 'New Zealand',     rate: 0.03, flat: 0.25, cur: 'NZ$' },
}

const num = (s: string) => {
  const n = parseFloat(s)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function Field({ label, value, onChange, prefix, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.inkSoft, marginBottom: 6 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 2px 0 10px', fontSize: 13, color: C.inkFaint, fontFamily: MONO, flexShrink: 0 }}>{prefix}</span>}
        <input type="number" min="0" step="0.01" inputMode="decimal" value={value} placeholder={placeholder ?? '0.00'}
          onChange={e => onChange(e.target.value)}
          style={{ background: 'transparent', border: 'none', padding: '9px 8px', fontSize: 13.5, fontFamily: MONO, outline: 'none', flex: 1, color: '#1a1a1a', width: '100%', minWidth: 0 }} />
      </div>
    </label>
  )
}

function Row({ label, value, cur, strong, accent }: {
  label: string; value: number; cur: string; strong?: boolean; accent?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.cardBorder}` }}>
      <span style={{ fontSize: strong ? 12.5 : 12, fontWeight: strong ? 600 : 400, color: strong ? C.charcoal : C.inkSoft }}>{label}</span>
      <span style={{ fontSize: strong ? 13 : 12.5, fontWeight: strong ? 700 : 500, fontFamily: MONO, color: accent ?? (strong ? C.charcoal : C.inkSoft) }}>
        {value < 0 ? '-' : ''}{cur}{Math.abs(value).toFixed(2)}
      </span>
    </div>
  )
}

export function FeeCalculatorTab() {
  const [price, setPrice] = useState('25.00')
  const [shipping, setShipping] = useState('5.00')
  const [cost, setCost] = useState('8.00')
  const [qty, setQty] = useState('1')
  const [region, setRegion] = useState('US')
  const [offsiteAds, setOffsiteAds] = useState(false)

  const proc = PROCESSING[region]
  const cur = proc.cur

  const r = useMemo(() => {
    const quantity = Math.max(1, Math.floor(num(qty) || 1))
    const perItem = num(price) + num(shipping)
    const revenue = perItem * quantity

    const listingFee = LISTING_FEE * quantity
    const transactionFee = revenue * TRANSACTION_RATE
    const processingFee = revenue * proc.rate + proc.flat
    const adsFee = offsiteAds ? revenue * OFFSITE_ADS_RATE : 0
    const totalFees = listingFee + transactionFee + processingFee + adsFee

    const itemCostTotal = num(cost) * quantity
    const net = revenue - totalFees - itemCostTotal
    const margin = revenue > 0 ? (net / revenue) * 100 : 0
    const feePct = revenue > 0 ? (totalFees / revenue) * 100 : 0

    // Break-even item price: the lowest price where net profit = 0, holding the
    // current shipping, item cost and quantity fixed.
    //   revenue·(1 − feeRate) = listingFees + processingFlat + itemCostTotal
    const feeRate = TRANSACTION_RATE + proc.rate + (offsiteAds ? OFFSITE_ADS_RATE : 0)
    const requiredRevenue = (LISTING_FEE * quantity + proc.flat + itemCostTotal) / (1 - feeRate)
    const breakEven = Math.max(0, requiredRevenue / quantity - num(shipping))

    return { quantity, revenue, listingFee, transactionFee, processingFee, adsFee, totalFees, itemCostTotal, net, margin, feePct, breakEven }
  }, [price, shipping, cost, qty, offsiteAds, proc.rate, proc.flat])

  const netAccent = r.net >= 0 ? C.success : C.danger

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 12, alignItems: 'start' }}>

        {/* ── Inputs ────────────────────────────────────────────── */}
        <Card pad="18px 18px 20px">
          <SectionTitle>Order details</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Item price" value={price} onChange={setPrice} prefix={cur} />
              <Field label="Shipping charged" value={shipping} onChange={setShipping} prefix={cur} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Item cost (yours)" value={cost} onChange={setCost} prefix={cur} />
              <Field label="Quantity" value={qty} onChange={setQty} placeholder="1" />
            </div>

            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.inkSoft, marginBottom: 6 }}>Payment processing region</span>
              <select value={region} onChange={e => setRegion(e.target.value)}
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: '#1a1a1a', outline: 'none', cursor: 'pointer' }}>
                {Object.entries(PROCESSING).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — {(v.rate * 100).toFixed(0)}% + {v.cur}{v.flat.toFixed(2)}</option>
                ))}
              </select>
            </label>

            <button onClick={() => setOffsiteAds(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: offsiteAds ? C.orangeFaint : C.bg, border: `1px solid ${offsiteAds ? C.orange : C.cardBorder}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              <span style={{ width: 34, height: 20, borderRadius: 999, background: offsiteAds ? C.orange : '#d8d6d0', position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
                <span style={{ position: 'absolute', top: 2, left: offsiteAds ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: C.charcoal }}>Offsite Ads fee (15%)</span>
                <span style={{ display: 'block', fontSize: 11, color: C.inkFaint, marginTop: 1 }}>Include if this sale came from an Etsy offsite ad.</span>
              </span>
            </button>
          </div>
        </Card>

        {/* ── Breakdown ─────────────────────────────────────────── */}
        <Card pad="18px 18px 20px">
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.inkFaint }}>{r.quantity > 1 ? `${r.quantity} items` : '1 item'}</span>}>
            Fee breakdown
          </SectionTitle>

          <div style={{ marginBottom: 4 }}>
            <Row label="Revenue (item + shipping)" value={r.revenue} cur={cur} strong />
            <Row label="Listing fee" value={-r.listingFee} cur={cur} accent={C.inkSoft} />
            <Row label="Transaction fee (6.5%)" value={-r.transactionFee} cur={cur} accent={C.inkSoft} />
            <Row label={`Payment processing (${(proc.rate * 100).toFixed(0)}% + ${cur}${proc.flat.toFixed(2)})`} value={-r.processingFee} cur={cur} accent={C.inkSoft} />
            {r.adsFee > 0 && <Row label="Offsite Ads (15%)" value={-r.adsFee} cur={cur} accent={C.inkSoft} />}
            <Row label="Total Etsy fees" value={-r.totalFees} cur={cur} strong accent={C.danger} />
            {r.itemCostTotal > 0 && <Row label="Your item cost" value={-r.itemCostTotal} cur={cur} accent={C.inkSoft} />}
          </div>

          {/* Net profit highlight */}
          <div style={{ marginTop: 14, background: r.net >= 0 ? C.successBg : C.dangerBg, borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, fontFamily: MONO, color: netAccent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>You keep</p>
              <p style={{ fontSize: 30, fontWeight: 800, color: netAccent, letterSpacing: '-1px', lineHeight: 1.05 }}>
                {r.net < 0 ? '-' : ''}{cur}{Math.abs(r.net).toFixed(2)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, fontFamily: MONO, color: netAccent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profit margin</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: netAccent, letterSpacing: '-0.5px' }}>{r.margin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Break-even helper */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: C.bg, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontFamily: MONO, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Break-even item price</p>
              <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>
                Sell above <strong style={{ color: C.charcoal, fontFamily: MONO }}>{cur}{r.breakEven.toFixed(2)}</strong> to profit at your current cost, shipping &amp; quantity.
              </p>
            </div>
            <button onClick={() => setPrice(r.breakEven.toFixed(2))}
              style={{ flexShrink: 0, background: C.card, color: C.orange, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.orange; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = C.card; e.currentTarget.style.color = C.orange }}>
              Apply
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: C.inkFaint }}>Etsy fees take <strong style={{ color: C.charcoal }}>{r.feePct.toFixed(1)}%</strong> of revenue</span>
            <span style={{ fontSize: 11, color: C.inkFaint }}>Fees are estimates — confirm current rates with Etsy.</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
