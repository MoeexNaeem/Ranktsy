import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getValidEtsyAuth } from '@/lib/etsy-tokens'
import { getShopReceiptsPaged } from '@/lib/etsy'
import type { ApiResponse, OrdersInsight } from '@/types'

export const runtime = 'nodejs'

// Country names for the ISO codes Etsy actually returns. Unmapped codes fall
// back to the raw ISO rather than being dropped.
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', DE: 'Germany',
  FR: 'France', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', SE: 'Sweden', NO: 'Norway',
  IE: 'Ireland', NZ: 'New Zealand', JP: 'Japan', CH: 'Switzerland', BE: 'Belgium', AT: 'Austria',
  DK: 'Denmark', FI: 'Finland', PL: 'Poland', PT: 'Portugal', GR: 'Greece', CZ: 'Czechia',
  MX: 'Mexico', BR: 'Brazil', IN: 'India', SG: 'Singapore', KR: 'South Korea', IL: 'Israel',
  AE: 'United Arab Emirates', ZA: 'South Africa', HK: 'Hong Kong', TW: 'Taiwan', TR: 'Türkiye',
}

/**
 * Buyer geography + fulfilment state for the signed-in user's OWN shop.
 *
 * This is the one place Etsy exposes buyer country — receipts carry
 * `country_iso`, and only under OAuth for your own shop. There is no public
 * buyer-geography endpoint for arbitrary shops, which is why Searchers-by-Country
 * elsewhere in the app comes from Google Ads instead.
 */
export async function GET(): Promise<NextResponse<ApiResponse<OrdersInsight>>> {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const auth = await getValidEtsyAuth(user.id)
  if (!auth) return NextResponse.json({ success: true, data: { connected: false } as OrdersInsight })

  try {
    const receipts = await getShopReceiptsPaged(auth.accessToken, auth.shopId, 400)

    if (!receipts.length) {
      return NextResponse.json({
        success: true,
        data: {
          connected: true, sampled: 0, currency: 'USD', revenue: 0, orders: 0, avgOrder: 0,
          countries: [], fulfilment: { paid: 0, unpaid: 0, shipped: 0, unshipped: 0, awaitingShipment: 0 },
          unshippedList: [], oldestOrder: null, newestOrder: null,
        },
      })
    }

    // Receipts are the shop's own orders, so they share the shop currency — a
    // mean is safe here, unlike a cross-shop listing search.
    const currency = receipts[0]?.currency ?? 'USD'
    const revenue = receipts.reduce((s, r) => s + r.grandtotal, 0)

    const byCountry = new Map<string, { orders: number; revenue: number }>()
    for (const r of receipts) {
      const iso = (r.country_iso || '').toUpperCase() || 'ZZ'
      const cur = byCountry.get(iso) ?? { orders: 0, revenue: 0 }
      cur.orders++
      cur.revenue += r.grandtotal
      byCountry.set(iso, cur)
    }

    const countries = [...byCountry.entries()]
      .map(([iso, v]) => ({
        iso,
        name: iso === 'ZZ' ? 'Unknown' : (COUNTRY_NAMES[iso] ?? iso),
        orders: v.orders,
        revenue: parseFloat(v.revenue.toFixed(2)),
        pct: parseFloat(((v.orders / receipts.length) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.orders - a.orders)

    const paid = receipts.filter(r => r.is_paid).length
    const shipped = receipts.filter(r => r.is_shipped).length
    // The actionable bucket: money taken, goods not sent.
    const awaitingShipment = receipts.filter(r => r.is_paid && !r.is_shipped).length

    const unshippedList = receipts
      .filter(r => r.is_paid && !r.is_shipped)
      .sort((a, b) => a.created_timestamp - b.created_timestamp)   // oldest first — most urgent
      .slice(0, 25)
      .map(r => ({
        receiptId: r.receipt_id,
        createdAt: r.created_timestamp,
        ageDays: Math.floor((Date.now() / 1000 - r.created_timestamp) / 86_400),
        total: parseFloat(r.grandtotal.toFixed(2)),
        currency: r.currency,
        countryIso: r.country_iso || null,
      }))

    const times = receipts.map(r => r.created_timestamp).filter(Boolean).sort((a, b) => a - b)

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        sampled: receipts.length,
        currency,
        revenue: parseFloat(revenue.toFixed(2)),
        orders: receipts.length,
        avgOrder: parseFloat((revenue / receipts.length).toFixed(2)),
        countries,
        fulfilment: {
          paid, unpaid: receipts.length - paid,
          shipped, unshipped: receipts.length - shipped,
          awaitingShipment,
        },
        unshippedList,
        oldestOrder: times[0] ?? null,
        newestOrder: times[times.length - 1] ?? null,
      },
    })
  } catch (e) {
    console.error('[Orders] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load your Etsy orders.' }, { status: 502 })
  }
}
