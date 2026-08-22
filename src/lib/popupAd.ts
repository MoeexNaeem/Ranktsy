import { connectDB } from '@/lib/db'
import { PopupAd } from '@/lib/models'
import type { IPopupAd } from '@/types'

const SEED_KEY = 'pro-1yr-popup'

/**
 * Idempotently ensure the built-in Pro · 1-Year popup ad exists (enabled by
 * default so it shows on first visit). Created exactly once via seedKey; admins
 * can freely edit, disable or replace it afterwards without it being recreated.
 */
export async function ensureDefaultPopupAd(): Promise<void> {
  await connectDB()
  await PopupAd.updateOne(
    { seedKey: SEED_KEY },
    {
      $setOnInsert: {
        enabled: true,
        mode: 'card',
        badge: 'Best value',
        title: 'Pro · 1-Year - Best Value',
        description: 'A full year of Rankkw Pro at a locked-in price, 20 AI listing images every month, plus a one-time bonus pack of 100 ready-to-list products, titles, descriptions and images.',
        price: '$99.99',
        priceNote: 'per year · ~$7.50 / mo',
        ctaLabel: 'Learn more',
        ctaUrl: '/deals/pro-1-year-plan',
        seedKey: SEED_KEY,
      },
    },
    { upsert: true },
  ).catch(() => {})
}

/** The single active popup ad (newest enabled), or null. */
export async function getActivePopupAd(): Promise<IPopupAd | null> {
  await connectDB()
  await ensureDefaultPopupAd()
  return PopupAd.findOne({ enabled: true }).sort({ updatedAt: -1 }).lean<IPopupAd>().catch(() => null)
}
