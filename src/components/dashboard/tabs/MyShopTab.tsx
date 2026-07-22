'use client'
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { BarChart } from '@/components/charts/BarChart'
import { Card, StatCard, SectionTitle, ErrorBox, Loading, MONO } from '../kit'
import { AiInsights } from '../AiInsights'
import { C, formatNumber } from '@/utils'
import type { AiFact } from '@/types'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', NZD: 'NZ$' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')

interface Insights {
  connected: boolean
  shop?: { shop_id: number; shop_name: string; url: string; icon: string; currency: string; active_listings: number; favorers: number; review_count: number; review_average: number }
  summary?: { revenue: number; orders: number; avgOrder: number; currency: string }
  salesByMonth?: { month: string; value: number }[]
  salesByCountry?: { iso: string; name: string; value: number }[]
  topListings?: { listing_id: number; title: string; url: string; views: number; num_favorers: number; price: number; currency: string; image: string }[]
  note?: string
}

export function MyShopTab() {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['etsy-insights'],
    queryFn: async () => (await axios.get('/api/etsy/insights')).data.data as Insights,
    staleTime: 1000 * 60 * 10,
    retry: false,
  })

  const disconnect = useMutation({
    mutationFn: async () => (await axios.post('/api/etsy/oauth/disconnect')).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['etsy-insights'] }); qc.invalidateQueries({ queryKey: ['auth'] }) },
  })

  const cur = useMemo(() => sym(data?.summary?.currency ?? data?.shop?.currency), [data])

  if (isLoading) return <Loading label="Checking your Etsy connection…" />
  if (isError) return <ErrorBox>Couldn&apos;t reach the shop-insights service. Please try again.</ErrorBox>

  // ── Not connected → CTA ──────────────────────────────────────────────────────
  if (!data?.connected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: C.charcoal, borderRadius: 14, padding: '40px 32px', color: C.snow }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(252,252,247,0.7)', marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} /> Shop Insights
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 400, letterSpacing: '-0.6px', marginBottom: 12, maxWidth: 560, lineHeight: 1.2 }}>
            Connect your Etsy shop to unlock real sales insights.
          </h2>
          <p style={{ fontSize: 14.5, color: 'rgba(252,252,247,0.75)', lineHeight: 1.6, maxWidth: 520, marginBottom: 24 }}>
            See your revenue, orders, best-selling listings, and a map of where your buyers are — pulled securely from the official Etsy API. Your data is never shared, and you can disconnect anytime.
          </p>
          <a href="/api/etsy/oauth/connect"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.orange, color: '#fff', textDecoration: 'none', padding: '13px 26px', borderRadius: 28, fontSize: 15, fontWeight: 500, transition: 'opacity 0.18s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            Connect your Etsy shop →
          </a>
          <div style={{ display: 'flex', gap: '10px 22px', flexWrap: 'wrap', marginTop: 22 }}>
            {['Read-only access', 'Official Etsy OAuth', 'Revoke anytime'].map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontFamily: MONO, color: 'rgba(252,252,247,0.6)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>{t}
              </span>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: '#9a9a92', fontFamily: MONO, lineHeight: 1.6 }}>
          Note: Etsy&apos;s API exposes orders, listings and shop stats — but not page-visit/traffic analytics, so those aren&apos;t shown.
        </p>
      </div>
    )
  }

  // ── Connected → insights ─────────────────────────────────────────────────────
  const s = data.shop!
  const sum = data.summary!
  const months = data.salesByMonth ?? []
  const countries = data.salesByCountry ?? []
  const listings = data.topListings ?? []

  // Real facts from the connected shop, for the AI performance read.
  const aiFacts: AiFact[] = [
    { label: 'Recent revenue', value: `${cur}${formatNumber(sum.revenue)}`, hint: 'from latest receipts' },
    { label: 'Orders', value: formatNumber(sum.orders), hint: 'recent receipts' },
    { label: 'Avg order value', value: `${cur}${sum.avgOrder}` },
    { label: 'Active listings', value: formatNumber(s.active_listings) },
    { label: 'Rating', value: `${s.review_average?.toFixed(2) ?? '—'}★`, hint: `${formatNumber(s.review_count)} reviews` },
    { label: 'Admirers', value: formatNumber(s.favorers) },
  ]
  if (countries[0]) aiFacts.push({ label: 'Top buyer country', value: countries[0].name, hint: `${cur}${formatNumber(countries[0].value)} revenue` })
  if (listings[0]) aiFacts.push({ label: 'Top listing', value: listings[0].title.slice(0, 45), hint: `${formatNumber(listings[0].views)} views, ${formatNumber(listings[0].num_favorers)} favs` })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Shop header */}
      <div className="rstack-sm" style={{ display: 'flex', alignItems: 'center', gap: 16, background: C.paper, border: `1px solid ${C.hairInk}`, borderRadius: 10, padding: '16px 18px' }}>
        {s.icon
          ? <img src={s.icon} alt={s.shop_name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 52, height: 52, borderRadius: 12, background: C.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 500, flexShrink: 0 }}>{s.shop_name.charAt(0).toUpperCase()}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: C.ink }}>{s.shop_name}</h2>
            <span style={{ fontSize: 10.5, fontFamily: MONO, background: C.successBg, color: C.success, padding: '2px 9px', borderRadius: 999, fontWeight: 500, textTransform: 'uppercase' }}>Connected</span>
          </div>
          <p style={{ fontSize: 12.5, color: '#8a8a82', marginTop: 2, fontFamily: MONO }}>
            {formatNumber(s.active_listings)} active listings · {formatNumber(s.favorers)} admirers · ★ {s.review_average?.toFixed(1) ?? '—'} ({formatNumber(s.review_count)})
          </p>
        </div>
        <div className="rfull-sm" style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontFamily: MONO, color: C.ink, textDecoration: 'none', border: `1px solid ${C.hairInk}`, padding: '7px 14px', borderRadius: 100 }}>View on Etsy ↗</a>}
          <button onClick={() => { if (confirm('Disconnect your Etsy shop? You can reconnect anytime.')) disconnect.mutate() }} disabled={disconnect.isPending}
            style={{ fontSize: 12.5, fontFamily: MONO, color: C.danger, background: 'transparent', border: `1px solid ${C.dangerBg}`, padding: '7px 14px', borderRadius: 100, cursor: 'pointer' }}>
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <StatCard label="Recent revenue" value={`${cur}${formatNumber(sum.revenue)}`} accent={C.orange} sub="from latest receipts" />
        <StatCard label="Orders" value={formatNumber(sum.orders)} accent={C.ink} sub="recent receipts" />
        <StatCard label="Avg order value" value={`${cur}${sum.avgOrder}`} accent={C.ink} sub="per order" />
      </div>

      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Revenue by month */}
        <Card>
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>last 6 months</span>}>Revenue trend</SectionTitle>
          {months.some(m => m.value > 0)
            ? <BarChart axis="x" height={230} color={C.orange} labels={months.map(m => m.month)} values={months.map(m => m.value)} />
            : <p style={{ fontSize: 12.5, color: '#9a9a92', padding: '30px 0', textAlign: 'center' }}>No recent orders in this window yet.</p>}
        </Card>

        {/* Sales map (by country) */}
        <Card>
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>revenue by country</span>}>Where buyers are</SectionTitle>
          {countries.length
            ? <BarChart axis="y" height={230} highlightMax labels={countries.map(c => c.name)} values={countries.map(c => c.value)} />
            : <p style={{ fontSize: 12.5, color: '#9a9a92', padding: '30px 0', textAlign: 'center' }}>No buyer-location data yet.</p>}
        </Card>
      </div>

      {/* Top listings */}
      {listings.length > 0 && (
        <Card>
          <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080' }}>by lifetime views</span>}>Your top listings</SectionTitle>
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {listings.slice(0, 8).map(l => (
              <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textDecoration: 'none', border: `1px solid ${C.hair}`, borderRadius: 8, overflow: 'hidden', background: C.paper, transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.orange)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.hair)}>
                {l.image ? <img src={l.image} alt={l.title} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', height: 110, background: C.bone }} />}
                <div style={{ padding: '9px 11px' }}>
                  <p style={{ fontSize: 11.5, color: C.ink, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 5 }}>{l.title}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontFamily: MONO, color: '#8a8a82' }}>
                    <span style={{ color: C.orange, fontWeight: 500 }}>{sym(l.currency)}{l.price.toFixed(0)}</span>
                    <span>{formatNumber(l.views)}👁 · {formatNumber(l.num_favorers)}♥</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* AI performance read of your connected shop. */}
      <AiInsights
        tool="My Shop"
        subject={s.shop_name}
        facts={aiFacts}
        notes="These are the seller's OWN connected-shop figures from the official Etsy API (receipts, listings, shop stats — Etsy exposes no page-traffic analytics). Interpret the shop's recent performance, best markets and listings, and give prioritised growth actions."
      />

      {data.note && <p style={{ fontSize: 11.5, color: '#9a9a92', fontFamily: MONO, lineHeight: 1.6 }}>{data.note}</p>}
    </div>
  )
}
