/* Plain data module (NO 'use client') so both Server Components (the /pricing page)
   and Client Components (the landing section, the card/table components) import the
   real arrays — a "use client" export would arrive at the server as a stub. */

export type Plan = {
  name: string
  slug: string
  price: string
  period: string
  note?: string       // secondary price line (e.g. 2-year deal / per-month equivalent)
  blurb: string
  features: string[]
  expandable?: string[]        // extra bullets revealed by a tap/click arrow on the card (optional)
  expandableHeading?: string   // small heading shown above the expandable bullets (optional)
  expandableFootnote?: string  // small note shown below the expandable bullets (optional)
  cta: string
  href: string
  accent: string
  popular?: boolean
}

// Prices in USD. CTAs are display-only for now (checkout deferred) — they deep-link
// to /register?plan=<slug>. Etsy Listing Pro (1 image per generation) is gated to
// Pro and up, with a monthly image allowance that scales with the plan.
export const PLANS: Plan[] = [
  {
    name: 'Free', slug: 'free', price: '$0', period: 'forever', accent: '#2E7D46',
    blurb: 'Explore the tools, free forever.',
    features: ['50 credits / day', '5 keyword searches / day', '1 shop · 50 listings', '5 listing audits / day', 'Etsy Listing Pro — 1 image / mo', 'Basic keyword metrics'],
    cta: 'Start for free', href: '/register',
  },
  {
    name: 'Starter', slug: 'starter', price: '$0.99', period: 'per month', accent: '#2563EB',
    blurb: 'A little more room to research.',
    features: ['100 credits / day', '25 keyword searches / day', '2 competitors monitored', '20 listing audits / day', 'Etsy Listing Pro — 2 images / mo', 'Tag generator'],
    cta: 'Choose Starter', href: '/register?plan=starter',
  },
  {
    name: 'Basic', slug: 'basic', price: '$2.99', period: 'per month', accent: '#0EA5E9',
    blurb: 'For sellers getting serious about SEO.',
    features: ['200 credits / day', '100 keyword searches / day', '5 competitors monitored', '200 connected shop listings', '50 listing audits / day', 'Etsy Listing Pro — 3 images / mo'],
    cta: 'Choose Basic', href: '/register?plan=basic',
  },
  {
    name: 'Pro', slug: 'pro', price: '$6.99', period: 'per month', accent: '#FB5E09', popular: true,
    blurb: 'Everything to grow — includes Etsy Listing Pro.',
    features: [
      '400 credits / day',
      '200 keyword searches / day',
      '50 competitors monitored',
      'Etsy Listing Pro — 5 images / mo',
      'Trends, product research & rank tracking',
      'AI title, tag & description',
      'CSV export',
    ],
    cta: 'Choose Pro', href: '/register?plan=pro',
  },
  {
    name: 'Pro · 1-Year', slug: 'pro-1yr', price: '$99.99', period: 'per year', accent: '#B7791F',
    note: '≈ $7.50 / mo · best value',
    blurb: 'All of Pro for a year — with more images.',
    features: [
      '1,000 credits / day',
      'Everything in Pro',
      'Etsy Listing Pro — 20 images / mo',
      '200 keyword searches / day',
      'Priority support',
      'Locked-in 1-year price',
    ],
    expandable: [
      '100 Digital Products ready to list',
      '100 SEO-Optimized Product Titles',
      '100 SEO-Optimized Product Descriptions',
      '100 Professional Product Listing Images',
      '30-Minute One-on-One Consultation',
    ],
    cta: 'Get 1-Year Pro', href: '/register?plan=pro-1yr',
  },
  {
    name: 'Business', slug: 'business', price: '$19.99', period: 'per month', accent: '#0D9488',
    blurb: 'For growing shops that need more images.',
    features: [
      '1,000 credits / day',
      '500 keyword searches / day',
      'Etsy Listing Pro — 15 images / mo',
      '3 shops · 10,000 listings',
      '100 competitors monitored',
      'Advanced analytics · priority support',
    ],
    cta: 'Choose Business', href: '/register?plan=business',
  },
  {
    name: 'Agency', slug: 'agency', price: '$39.99', period: 'per month', accent: '#7C3AED',
    blurb: 'Multiple shops & clients, white-labeled.',
    features: [
      '2,000 credits / day',
      '1,000 keyword searches / day',
      'Etsy Listing Pro — 30 images / mo',
      '10 shops · white-label reports',
      '200 competitors monitored',
      'Client dashboard',
    ],
    cta: 'Choose Agency', href: '/register?plan=agency',
  },
  {
    name: 'Enterprise', slug: 'enterprise', price: '$49.99', period: 'per month', accent: '#4F46E5',
    blurb: 'Maximum scale and dedicated support.',
    features: [
      '2,500 credits / day',
      '2,000 keyword searches / day',
      'Etsy Listing Pro — 50 images / mo',
      'Unlimited shops',
      '500 competitors monitored',
      'Dedicated support',
    ],
    cta: 'Choose Enterprise', href: '/register?plan=enterprise',
  },
  {
    name: 'Custom', slug: 'custom', price: 'from $49.99', period: 'per month', accent: '#5B6472',
    blurb: 'Tailored limits and images for your team.',
    features: [
      '2,500 credits / day',
      'Everything in Enterprise',
      'Etsy Listing Pro — 50 images / mo (+$10 per extra 20)',
      'Custom searches & limits',
      'Onboarding & SLA',
    ],
    cta: 'Contact sales', href: '/contact',
  },
]

export type Cell = boolean | string

// Each row's `cells` MUST stay aligned to PLANS order (9 wide):
// [Free, Starter, Basic, Pro, Pro·2-Year, Business, Agency, Enterprise, Custom]
export const GROUPS: { group: string; rows: { label: string; cells: Cell[] }[] }[] = [
  { group: 'Keywords & research', rows: [
    { label: 'Daily credits (other tools)', cells: ['50', '100', '200', '400', '1,000', '1,000', '2,000', '2,500', '2,500'] },
    { label: 'Keyword searches / day', cells: ['5', '25', '100', '200', '200', '500', '1,000', '2,000', 'Custom'] },
    { label: 'Keyword metrics (volume, KD, competition)', cells: ['Basic', true, true, true, true, true, true, true, true] },
    { label: 'Competitors monitored', cells: [false, '2', '5', '50', '50', '100', '200', '500', 'Custom'] },
    { label: 'Connected shop listings', cells: ['50', '100', '200', '4,000', '4,000', '10,000', '25,000', '50,000', 'Custom'] },
    { label: 'Trends & product research', cells: [false, false, false, true, true, true, true, true, true] },
    { label: 'Keyword / rank tracking', cells: [false, false, false, true, true, true, true, true, true] },
  ] },
  { group: 'Listings & AI', rows: [
    { label: 'Listing audits / day', cells: ['5', '20', '50', '200', '200', '500', '1,000', '2,000', 'Custom'] },
    { label: 'Tag generator', cells: [false, true, true, true, true, true, true, true, true] },
    { label: 'AI title / tag / description', cells: [false, false, 'Basic', true, true, true, true, true, true] },
    { label: 'Etsy Listing Pro', cells: [true, true, true, true, true, true, true, true, true] },
    { label: 'Etsy Listing Pro images / month', cells: ['1', '2', '3', '5', '20', '15', '30', '50', '50 +'] },
    { label: 'CSV export', cells: [false, false, false, true, true, true, true, true, true] },
  ] },
  { group: 'Shops & team', rows: [
    { label: 'Shops', cells: ['1', '1', '1', '1', '1', '3', '10', 'Unlimited', 'Custom'] },
    { label: 'Shop analytics', cells: ['Basic', true, true, true, true, 'Advanced', 'Advanced', 'Advanced', 'Advanced'] },
    { label: 'Bulk listing optimization', cells: [false, false, false, false, false, true, true, true, true] },
    { label: 'White-label reports', cells: [false, false, false, false, false, false, true, true, true] },
    { label: 'Client dashboard', cells: [false, false, false, false, false, false, true, true, true] },
  ] },
  { group: 'Support', rows: [
    { label: 'Support', cells: ['Community', 'Email', 'Email', 'Email', 'Priority', 'Priority', 'Priority', 'Dedicated', 'Dedicated'] },
  ] },
]

/* ── Geo pricing: PKR for Pakistan, USD everywhere else ──────────────────────
   USD lives on each Plan (the default). PKR overrides are keyed by slug so the
   plan objects stay single-source; period/blurb/features are currency-agnostic. */
export type Currency = 'USD' | 'PKR'

const PKR_OVERRIDES: Record<string, { price: string; note?: string }> = {
  free:         { price: 'Rs 0' },
  starter:      { price: 'Rs 250' },
  basic:        { price: 'Rs 750' },
  pro:          { price: 'Rs 1,750' },
  'pro-1yr':    { price: 'Rs 18,750', note: '≈ Rs 1,563 / mo · best value' },
  business:     { price: 'Rs 4,999' },
  agency:       { price: 'Rs 9,999' },
  enterprise:   { price: 'Rs 12,500' },
  custom:       { price: 'from Rs 12,500' },
}

export const priceOf = (p: Plan, cur: Currency): string =>
  cur === 'PKR' ? (PKR_OVERRIDES[p.slug]?.price ?? p.price) : p.price

export const noteOf = (p: Plan, cur: Currency): string | undefined =>
  cur === 'PKR' ? (PKR_OVERRIDES[p.slug]?.note ?? p.note) : p.note