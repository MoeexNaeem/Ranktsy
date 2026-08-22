import { connectDB } from '@/lib/db'
import { Deal } from '@/lib/models'
import { slugifyTitle } from '@/lib/blog'

/** Re-export so deal code has one import site for slugs. */
export { slugifyTitle }

/** First ~180 chars of plain text from a deal's markdown, for the card teaser. */
export function dealSummaryFrom(markdown: string, max = 180): string {
  const plain = (markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain
}

const ONE_YEAR_SEED_KEY = 'pro-1yr-deal'

/**
 * Idempotently ensure the built-in "Pro · 1-Year" deal exists. Uses a stable
 * slug + seedKey with an upsert-on-insert, so it's created exactly once no
 * matter how many times this runs, and an admin can freely edit or unpublish it
 * afterwards without it being recreated/overwritten.
 */
export async function ensureDefaultDeals(): Promise<void> {
  await connectDB()
  const content = `## Lock in a full year of Pro - for less

The **Pro · 1-Year** plan gives you everything in Rankkw Pro for twelve months at a locked-in price that works out to about **$7.50 / month** - our best value. One payment, a whole year of real Etsy & Google data at your side.

## Everything in Pro, all year

- **1,000 credits every day** for the tools - plenty of room to research, generate and optimize.
- **200 keyword searches / day** with real search volume, competition and CTR.
- **Etsy Listing Pro - 20 AI listing images per month** (four times the monthly Pro allowance).
- Trends, product research, competitor & rank tracking.
- AI title, tag and description generators grounded in real data.
- CSV export and priority support.

## A serious head start for your shop

New for 1-Year members - a one-time bonus pack to get products live fast:

- **100 digital products** ready to list
- **100 SEO-optimized product titles**
- **100 SEO-optimized product descriptions**
- **100 professional product listing images**
- A **30-minute one-on-one consultation** to map out your next quarter

## Why a yearly plan

If you're serious about growing on Etsy, a year of consistent, data-backed optimization beats stop-start monthly effort - and you lock today's price for the next twelve months. Click below to check out securely and start today.`

  await Deal.updateOne(
    { seedKey: ONE_YEAR_SEED_KEY },
    {
      $setOnInsert: {
        title: 'Pro · 1-Year - Best Value',
        slug: 'pro-1-year-plan',
        summary: 'A full year of Rankkw Pro at ~$7.50/mo, 20 AI listing images a month, plus a one-time bonus pack of 100 ready-to-list products, titles, descriptions and images.',
        content,
        badge: 'Best value',
        ctaLabel: 'Get 1-Year Plan',
        ctaPlan: 'pro-1yr',
        status: 'published',
        seedKey: ONE_YEAR_SEED_KEY,
      },
    },
    { upsert: true },
  ).catch(() => {})
}
