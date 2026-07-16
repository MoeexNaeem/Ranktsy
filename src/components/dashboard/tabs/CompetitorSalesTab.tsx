'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { VelocityPanel } from '../keyword/VelocityPanel'
import { ctrlBtn } from '../controls'
import { Card, SearchBar, SectionTitle, ErrorBox, EmptyState, MONO } from '../kit'
import { C, D, flag, formatNumber } from '@/utils'
import type { ApiResponse, EtsyShop } from '@/types'

interface Tracked { shopId: number; shopName: string }

function useTracked() {
  return useQuery({
    queryKey: ['tracked-shops'],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get<ApiResponse<Tracked[]>>('/api/etsy/tracked', { signal })
      if (!data.success) throw new Error(data.error ?? 'Failed to load tracked shops')
      return data.data ?? []
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}

function useShop(shop: string) {
  return useQuery({
    queryKey: ['shop-record', shop],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(`/api/etsy/shop?id=${encodeURIComponent(shop)}`, { signal })
      if (!data.success) throw new Error(data.error ?? 'Shop not found')
      return (data.data.shop ?? {}) as EtsyShop
    },
    enabled: shop.length > 1,
    staleTime: 1000 * 60 * 15,
    retry: false,
  })
}

/**
 * eRank's Competitor Sales, honestly.
 *
 * Etsy gives a shop's lifetime sales total and no series — so "sold yesterday"
 * only exists once we've captured the shop on two different days. Tracking a
 * shop guarantees a daily capture from that moment; nothing can recover the past.
 */
export function CompetitorSalesTab() {
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState('')
  const qc = useQueryClient()

  const { data: tracked, isError: trackedError } = useTracked()

  // Derived, not synced via an effect: with no explicit pick, fall back to the
  // first tracked shop so the tab opens on something useful. Deriving avoids the
  // extra render an effect+setState would cost, and can't desync.
  const active = picked || (tracked?.[0] ? String(tracked[0].shopId) : '')
  const setActive = setPicked

  const { data: shop, isLoading, isError } = useShop(active)

  const track = useMutation({
    mutationFn: async (shopName: string) => {
      const { data } = await axios.post<ApiResponse<Tracked>>('/api/etsy/tracked', { shop: shopName })
      if (!data.success) throw new Error(data.error ?? 'Could not track shop')
      return data.data!
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracked-shops'] }),
  })

  const untrack = useMutation({
    mutationFn: async (shopId: number) => {
      await axios.delete(`/api/etsy/tracked?shopId=${shopId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracked-shops'] }),
  })

  const go = useCallback(() => {
    const v = input.trim()
    if (v.length >= 2) setActive(v)
  }, [input])

  const isTracked = !!(shop && tracked?.some(t => t.shopId === shop.shop_id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SearchBar value={input} onChange={setInput} onSubmit={go}
          placeholder="Competitor shop name — e.g. CaitlynMinimalist" button="Analyze →" />
        <p style={{ fontSize: 13, color: C.graphite, marginTop: 10, lineHeight: 1.55, maxWidth: 720 }}>
          Etsy publishes each shop&apos;s <strong style={{ color: D.good }}>lifetime</strong>{' '}sales total and no history.
          Track a shop and we record it daily from then on — that&apos;s what turns a single number into sales-per-day.
        </p>
      </div>

      {/* Tracked shops */}
      {tracked && tracked.length > 0 && (
        <Card pad="16px 18px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tracked daily
            </span>
            {tracked.map(t => {
              const on = String(t.shopId) === active || t.shopName === active
              return (
                <span key={t.shopId} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 8px 5px 13px', borderRadius: 100,
                  background: on ? C.orangeFaint : C.bone, border: `1px solid ${on ? C.orange : 'transparent'}`,
                }}>
                  <button onClick={() => setActive(String(t.shopId))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: on ? C.orange : C.ink, padding: 0 }}>
                    {t.shopName}
                  </button>
                  <button onClick={() => untrack.mutate(t.shopId)} title={`Stop tracking ${t.shopName}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.stone, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              )
            })}
          </div>
        </Card>
      )}

      {trackedError && (
        <ErrorBox>Sign in to track competitor shops and build sales history.</ErrorBox>
      )}

      {isLoading && <div className="shimmer" style={{ height: 200, borderRadius: 16, background: '#e8e7e2' }} />}
      {isError && <ErrorBox>Couldn&apos;t find that shop on Etsy. Check the shop name.</ErrorBox>}

      {shop && !isLoading && (
        <>
          <div style={{ background: C.charcoal, borderRadius: 16, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h2 style={{ fontSize: 21, fontWeight: 500, color: C.snow, marginBottom: 6, letterSpacing: '-0.02em' }}>{shop.shop_name}</h2>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13.5, color: 'rgba(245,245,235,0.65)' }}>
                <span style={{ color: D.good, fontWeight: 500 }}>{shop.sales != null ? formatNumber(shop.sales) : '—'} lifetime sales</span>
                {shop.review_count ? <span>★ {(shop.review_average ?? 0).toFixed(2)} · {formatNumber(shop.review_count)} reviews</span> : null}
                {shop.countryIso && <span>{flag(shop.countryIso)} {shop.countryIso}</span>}
                {shop.yearOpened && <span>since {shop.yearOpened}</span>}
                <span>{formatNumber(shop.listing_active_count)} listings</span>
              </div>
            </div>
            <button
              onClick={() => !isTracked && track.mutate(shop.shop_name)}
              disabled={isTracked || track.isPending}
              style={{
                ...ctrlBtn, height: 40,
                background: isTracked ? 'transparent' : C.orange,
                color: isTracked ? 'rgba(245,245,235,0.7)' : '#fff',
                borderColor: isTracked ? 'rgba(245,245,235,0.3)' : C.orange,
                cursor: isTracked ? 'default' : 'pointer',
              }}>
              {isTracked ? '★ Tracked daily' : track.isPending ? 'Tracking…' : '☆ Track this shop'}
            </button>
          </div>

          <VelocityPanel shopId={shop.shop_id} shopName={shop.shop_name} />

          {!isTracked && (
            <div style={{ display: 'flex', gap: 11, padding: '13px 17px', background: D.midBg, borderRadius: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, lineHeight: 1.4 }}>💡</span>
              <p style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.6 }}>
                <strong>Track this shop</strong> to guarantee a daily reading. Untracked shops are only captured when
                someone happens to view them, which leaves gaps in the sales history.
              </p>
            </div>
          )}
        </>
      )}

      {!active && !isLoading && (
        <EmptyState icon="📈" title="Search a competitor shop" sub="See their real lifetime sales, then track them to build sales-per-day history." />
      )}
    </div>
  )
}
