import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getValidEtsyAuth } from '@/lib/etsy-tokens'
import { getShopByOwner, getOwnerListings, getShopReceipts } from '@/lib/etsy'
import { userIdFromToken } from '@/lib/etsy-oauth'

export const runtime = 'nodejs'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', DE: 'Germany',
  FR: 'France', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', SE: 'Sweden', NO: 'Norway',
  IE: 'Ireland', NZ: 'New Zealand', JP: 'Japan', CH: 'Switzerland', BE: 'Belgium', AT: 'Austria',
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const auth = await getValidEtsyAuth(user.id)
  if (!auth) return NextResponse.json({ success: true, data: { connected: false } })

  try {
    const etsyUserId = userIdFromToken(auth.accessToken)
    const [shop, listings, receipts] = await Promise.all([
      getShopByOwner(auth.accessToken, etsyUserId),
      getOwnerListings(auth.accessToken, auth.shopId, 'active', 100).catch(() => []),
      getShopReceipts(auth.accessToken, auth.shopId, 100).catch(() => []),
    ])

    const currency = shop.currency_code || receipts[0]?.currency || 'USD'
    const revenue = receipts.reduce((s, r) => s + r.grandtotal, 0)
    const orders = receipts.length
    const avgOrder = orders ? revenue / orders : 0

    // Revenue by month — last 6 months (rolling)
    const now = new Date()
    const monthKeys: { label: string; key: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthKeys.push({ label: MONTHS[d.getMonth()], key: `${d.getFullYear()}-${d.getMonth()}` })
    }
    const monthMap: Record<string, number> = {}
    for (const r of receipts) {
      const d = new Date(r.created_timestamp * 1000)
      monthMap[`${d.getFullYear()}-${d.getMonth()}`] = (monthMap[`${d.getFullYear()}-${d.getMonth()}`] ?? 0) + r.grandtotal
    }
    const salesByMonth = monthKeys.map(m => ({ month: m.label, value: Math.round(monthMap[m.key] ?? 0) }))

    // Sales map — revenue by buyer country
    const countryMap: Record<string, number> = {}
    for (const r of receipts) {
      const c = r.country_iso || '—'
      countryMap[c] = (countryMap[c] ?? 0) + r.grandtotal
    }
    const salesByCountry = Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([iso, amt]) => ({ iso, name: COUNTRY_NAMES[iso] ?? iso, value: Math.round(amt) }))

    // Top listings by lifetime views
    const topListings = [...listings]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 20)
      .map(l => ({
        listing_id: l.listing_id, title: l.title, url: l.url,
        views: l.views, num_favorers: l.num_favorers,
        price: l.price.amount / (l.price.divisor || 100), currency: l.price.currency_code,
        image: l.images?.[0]?.url_570xN ?? '',
      }))

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        shop: {
          shop_id: shop.shop_id, shop_name: shop.shop_name, url: shop.url,
          icon: shop.icon_url_fullxfull, currency,
          active_listings: shop.listing_active_count, favorers: shop.num_favorers,
          review_count: shop.review_count, review_average: shop.review_average,
        },
        summary: { revenue: Math.round(revenue), orders, avgOrder: Math.round(avgOrder), currency },
        salesByMonth, salesByCountry, topListings,
        note: 'Revenue and orders are computed from your most recent Etsy receipts (up to 100). Etsy’s API does not expose page-visit/traffic analytics.',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load shop insights'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
