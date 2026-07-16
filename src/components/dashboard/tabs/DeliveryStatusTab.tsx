'use client'
import { useMemo } from 'react'
import { MixDonut } from '@/components/charts/InsightCharts'
import { ExportBtn, toCsv, downloadCsv } from '../controls'
import { useOrders, ConnectShopPrompt } from './SalesMapTab'
import { Card, SectionTitle, ErrorBox, Loading, EmptyState, tableCard, tableHead, th, tableRow, MONO } from '../kit'
import { C, D, flag, formatNumber } from '@/utils'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')

const GRID = '0.9fr 0.7fr 0.8fr 0.7fr 1fr'

const fmtDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

/** Older unshipped orders are the ones that turn into bad reviews. */
function ageColor(days: number): string {
  if (days <= 2) return D.good
  if (days <= 5) return D.mid
  return D.hard
}

export function DeliveryStatusTab() {
  const { data, isLoading, isError } = useOrders()

  const donut = useMemo(() => {
    const f = data?.fulfilment
    if (!f) return []
    return [
      { label: 'Shipped', value: f.shipped, color: D.good },
      { label: 'Awaiting shipment', value: f.awaitingShipment, color: D.mid },
      { label: 'Unpaid', value: f.unpaid, color: C.stone },
    ].filter(s => s.value > 0)
  }, [data])

  const exportCsv = () => {
    if (!data?.unshippedList) return
    downloadCsv('awaiting-shipment.csv', toCsv(
      ['Receipt ID', 'Ordered', 'Age (days)', 'Total', 'Currency', 'Country'],
      data.unshippedList.map(o => [o.receiptId, fmtDate(o.createdAt), o.ageDays, o.total, o.currency, o.countryIso ?? '']),
    ))
  }

  if (isLoading) return <Loading label="Reading your Etsy orders…" />
  if (isError) return <ErrorBox>Couldn&apos;t load your orders from Etsy. Try reconnecting your shop.</ErrorBox>
  if (!data?.connected) return <ConnectShopPrompt what="Your delivery status" needsAuth={data?.needsAuth} />
  if (!data.orders) return <EmptyState icon="📦" title="No orders yet" sub="Fulfilment status appears once you've made a sale." />

  const f = data.fulfilment!
  const cur = sym(data.currency)
  const shipRate = data.orders ? (f.shipped / data.orders) * 100 : 0
  const oldest = data.unshippedList?.[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* The one number that needs action today */}
      {f.awaitingShipment > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '14px 18px', background: oldest && oldest.ageDays > 5 ? D.hardBg : D.midBg, borderRadius: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17 }}>📦</span>
          <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.5, flex: 1, minWidth: 240 }}>
            <strong>{f.awaitingShipment} paid order{f.awaitingShipment === 1 ? '' : 's'} awaiting shipment.</strong>
            {oldest && <> The oldest has been waiting <strong style={{ color: ageColor(oldest.ageDays) }}>{oldest.ageDays} day{oldest.ageDays === 1 ? '' : 's'}</strong>.</>}
          </p>
        </div>
      )}

      <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { k: 'Awaiting shipment', v: formatNumber(f.awaitingShipment), c: f.awaitingShipment > 0 ? D.mid : D.good, s: 'paid, not sent' },
          { k: 'Shipped', v: formatNumber(f.shipped), c: D.good, s: `${shipRate.toFixed(0)}% of orders` },
          { k: 'Unpaid', v: formatNumber(f.unpaid), c: f.unpaid > 0 ? C.stone : D.good, s: 'not yet paid' },
          { k: 'Orders sampled', v: formatNumber(data.sampled ?? 0), c: C.ink, s: data.oldestOrder ? `since ${fmtDate(data.oldestOrder)}` : '' },
        ].map(x => (
          <Card key={x.k} pad="18px 20px">
            <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9 }}>{x.k}</p>
            <p style={{ fontSize: 27, fontWeight: 500, color: x.c, letterSpacing: '-0.03em', lineHeight: 1 }}>{x.v}</p>
            <p style={{ fontSize: 12, color: C.stone, marginTop: 6 }}>{x.s}</p>
          </Card>
        ))}
      </div>

      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12, alignItems: 'start' }}>
        <Card>
          <SectionTitle>Fulfilment mix</SectionTitle>
          <MixDonut segments={donut} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
            {donut.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{s.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle right={data.unshippedList?.length ? <ExportBtn onClick={exportCsv} /> : undefined}>
            Oldest orders awaiting shipment
          </SectionTitle>
          {data.unshippedList?.length ? (
            <div className="rtable" style={{ ...tableCard, border: 'none' }}>
              <div style={tableHead(GRID)}>
                {['Ordered', 'Waiting', 'Total', 'Country', 'Receipt'].map(h => <span key={h} style={th}>{h}</span>)}
              </div>
              {data.unshippedList.map(o => (
                <div key={o.receiptId} style={tableRow(GRID)}>
                  <span style={{ fontSize: 13.5, color: C.ink }}>{fmtDate(o.createdAt)}</span>
                  <span style={{ fontSize: 13.5, fontFamily: MONO, fontWeight: 600, color: ageColor(o.ageDays) }}>
                    {o.ageDays}d
                  </span>
                  <span style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink }}>{sym(o.currency)}{o.total.toFixed(2)}</span>
                  <span style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink }}>{o.countryIso ? `${flag(o.countryIso)} ${o.countryIso}` : '—'}</span>
                  <a href="https://www.etsy.com/your/orders/sold" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite, textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.orange)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.graphite)}>
                    #{o.receiptId} ↗
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '44px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
              <p style={{ fontSize: 15.5, fontWeight: 500, color: D.good }}>Everything paid has shipped</p>
              <p style={{ fontSize: 13.5, color: C.graphite, marginTop: 5 }}>No outstanding fulfilment across your last {data.sampled} orders.</p>
            </div>
          )}
        </Card>
      </div>

      <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
        Real fulfilment state from your {data.sampled} most recent Etsy receipts (<code>is_paid</code> / <code>is_shipped</code>).
        Etsy doesn&apos;t expose carrier tracking progress through this API, so &ldquo;shipped&rdquo; means you marked it dispatched — not delivered.
      </p>
    </div>
  )
}
