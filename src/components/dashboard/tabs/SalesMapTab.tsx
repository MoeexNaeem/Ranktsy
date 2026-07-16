'use client'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { BarChart } from '@/components/charts/BarChart'
import { MixDonut } from '@/components/charts/InsightCharts'
import { ExportBtn, toCsv, downloadCsv } from '../controls'
import { Card, SectionTitle, ErrorBox, Loading, EmptyState, tableCard, tableHead, th, tableRow, MONO } from '../kit'
import { C, D, flag, formatNumber } from '@/utils'
import type { ApiResponse, OrdersInsight } from '@/types'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async ({ signal }) => {
      try {
        const { data } = await axios.get<ApiResponse<OrdersInsight>>('/api/etsy/orders', { signal })
        if (!data.success || !data.data) throw new Error(data.error ?? 'Failed to load orders')
        return data.data
      } catch (e) {
        // "Not signed in" is a different problem from "Etsy call failed", and
        // needs a different instruction — telling a signed-out visitor to
        // reconnect their shop sends them somewhere useless.
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          return { connected: false, needsAuth: true } as OrdersInsight
        }
        throw e
      }
    },
    staleTime: 1000 * 60 * 10,
    retry: false,
  })
}

/** Both order-based tabs need this, and neither works without OAuth. */
export function ConnectShopPrompt({ what, needsAuth }: { what: string; needsAuth?: boolean }) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 38, marginBottom: 14 }}>{needsAuth ? '🔐' : '🔗'}</div>
        <p style={{ fontSize: 18, fontWeight: 500, color: C.ink, marginBottom: 8 }}>
          {needsAuth ? 'Sign in to see your shop data' : 'Connect your Etsy shop'}
        </p>
        <p style={{ fontSize: 14, color: C.graphite, lineHeight: 1.6, maxWidth: 460, margin: '0 auto 20px' }}>
          {what} comes from your own Etsy order receipts, which only Etsy can release to you.
          {needsAuth
            ? ' Sign in to your Rankkw account, then connect your shop.'
            : <> Connect your shop from the <strong style={{ color: C.ink }}>My Shop</strong> tab to enable it.</>}
        </p>
        <p style={{ fontSize: 12, color: C.stone, fontFamily: MONO }}>
          Read-only · your data never leaves your account
        </p>
      </div>
    </Card>
  )
}

const GRID = '0.5fr 2fr 0.8fr 0.9fr 0.9fr'

export function SalesMapTab() {
  const { data, isLoading, isError } = useOrders()

  const chart = useMemo(() => {
    if (!data?.countries?.length) return null
    const top = data.countries.slice(0, 12)
    return {
      labels: top.map(c => c.name),
      values: top.map(c => c.orders),
      colors: top.map((_, i) => D.series[i % D.series.length] as string),
    }
  }, [data])

  const donut = useMemo(() => {
    if (!data?.countries?.length) return []
    const top = data.countries.slice(0, 5)
    const rest = data.countries.slice(5).reduce((s, c) => s + c.orders, 0)
    const segs = top.map((c, i) => ({ label: c.iso, value: c.orders, color: D.series[i % D.series.length] as string }))
    if (rest > 0) segs.push({ label: 'Other', value: rest, color: C.stone })
    return segs
  }, [data])

  const exportCsv = () => {
    if (!data?.countries) return
    downloadCsv('sales-by-country.csv', toCsv(
      ['Country', 'ISO', 'Orders', 'Revenue', 'Currency', 'Share %'],
      data.countries.map(c => [c.name, c.iso, c.orders, c.revenue, data.currency ?? '', c.pct]),
    ))
  }

  if (isLoading) return <Loading label="Reading your Etsy orders…" />
  if (isError) return <ErrorBox>Couldn&apos;t load your orders from Etsy. Try reconnecting your shop.</ErrorBox>
  if (!data?.connected) return <ConnectShopPrompt what="Your sales map" needsAuth={data?.needsAuth} />
  if (!data.orders) return <EmptyState icon="🗺️" title="No orders yet" sub="Your sales map appears once you've made a sale." />

  const cur = sym(data.currency)
  const topCountry = data.countries?.[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { k: 'Countries', v: String(data.countries?.length ?? 0), c: '#2E6DB4', s: 'buyers reached' },
          { k: 'Orders', v: formatNumber(data.orders ?? 0), c: D.good, s: `last ${data.sampled} receipts` },
          { k: 'Revenue', v: `${cur}${formatNumber(Math.round(data.revenue ?? 0))}`, c: C.orange, s: `avg ${cur}${(data.avgOrder ?? 0).toFixed(2)}` },
          { k: 'Top market', v: topCountry ? `${flag(topCountry.iso)} ${topCountry.iso}` : '—', c: C.ink, s: topCountry ? `${topCountry.pct}% of orders` : '' },
        ].map(x => (
          <Card key={x.k} pad="18px 20px">
            <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9 }}>{x.k}</p>
            <p style={{ fontSize: 27, fontWeight: 500, color: x.c, letterSpacing: '-0.03em', lineHeight: 1 }}>{x.v}</p>
            <p style={{ fontSize: 12, color: C.stone, marginTop: 6 }}>{x.s}</p>
          </Card>
        ))}
      </div>

      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, alignItems: 'start' }}>
        <Card>
          <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>orders</span>}>Where your buyers are</SectionTitle>
          {chart && <BarChart axis="y" height={Math.min(380, 60 + chart.labels.length * 28)} labels={chart.labels} values={chart.values} colors={chart.colors} />}
        </Card>
        <Card>
          <SectionTitle>Market share</SectionTitle>
          <MixDonut segments={donut} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
            {donut.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{s.label === 'Other' ? 'Other' : `${flag(s.label)} ${s.label}`}</span>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <SectionTitle>All markets</SectionTitle>
          <ExportBtn onClick={exportCsv} />
        </div>
        <div className="rtable" style={tableCard}>
          <div style={tableHead(GRID)}>
            {['', 'Country', 'Orders', 'Revenue', 'Share'].map(h => <span key={h} style={th}>{h}</span>)}
          </div>
          {data.countries?.map(c => (
            <div key={c.iso} style={tableRow(GRID)}>
              <span style={{ fontSize: 17 }}>{flag(c.iso)}</span>
              <span style={{ fontSize: 14.5, color: C.ink }}>{c.name}</span>
              <span style={{ fontSize: 14, fontFamily: MONO, color: C.ink }}>{c.orders}</span>
              <span style={{ fontSize: 14, fontFamily: MONO, color: C.orange, fontWeight: 500 }}>{cur}{formatNumber(Math.round(c.revenue))}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ flex: 1, height: 5, background: C.bone, borderRadius: 999, overflow: 'hidden', minWidth: 40 }}>
                  <div style={{ height: '100%', width: `${c.pct}%`, background: D.good, borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite, width: 42, textAlign: 'right' }}>{c.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
        Built from your {data.sampled} most recent Etsy receipts — real orders, not estimates. Buyer country comes from
        the receipt itself; Etsy exposes it only for your own shop, which is why this map can&apos;t be produced for a competitor.
      </p>
    </div>
  )
}
