/* Plain data module (NO 'use client') so both Server Components (the /pricing page)
   and Client Components (the landing section, the card/table components) import the
   real arrays — a "use client" export would arrive at the server as a stub. */

export type Plan = {
  name: string
  slug: string
  price: string
  period: string
  blurb: string
  features: string[]
  cta: string
  href: string
  accent: string
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    name: 'Free', slug: 'free', price: 'Rs 0', period: 'forever', accent: '#2E7D46',
    blurb: 'Get started and explore the basics.',
    features: ['5 keyword searches / day', 'Basic keyword metrics', 'Limited listing audit', 'Basic shop analytics'],
    cta: 'Start free', href: '/register',
  },
  {
    name: 'Starter', slug: 'starter', price: 'Rs 2,999', period: 'per month', accent: '#2F6FED',
    blurb: 'For sellers getting serious about SEO.',
    features: ['500 keyword searches / day', 'Listing optimization', 'Competitor tracking', 'Tag generator', 'Basic AI'],
    cta: 'Choose Starter', href: '/register?plan=starter',
  },
  {
    name: 'Pro', slug: 'pro', price: 'Rs 5,999', period: 'per month', accent: '#FB5E09',
    blurb: 'Everything you need to grow, unlimited.',
    features: ['Unlimited keyword research', 'AI Listing Generator', 'Trend Finder', 'Competitor analysis', 'Shop Audit', 'Product research', 'Keyword tracking', 'CSV export'],
    cta: 'Choose Pro', href: '/register?plan=pro', popular: true,
  },
  {
    name: 'Business', slug: 'business', price: 'Rs 11,999', period: 'per month', accent: '#1C5D5F',
    blurb: 'For growing teams and multiple shops.',
    features: ['Multi-shop support', 'Team members', 'Advanced analytics', 'Bulk listing optimization', 'Rank tracking', 'Priority support'],
    cta: 'Choose Business', href: '/register?plan=business',
  },
  {
    name: 'Agency', slug: 'agency', price: 'Rs 22,999', period: 'per month', accent: '#C0498A',
    blurb: 'Manage unlimited clients, white-labeled.',
    features: ['Unlimited shops', 'White-label reports', 'Client dashboard', 'Dedicated support'],
    cta: 'Choose Agency', href: '/register?plan=agency',
  },
]

export type Cell = boolean | string

export const GROUPS: { group: string; rows: { label: string; cells: Cell[] }[] }[] = [
  { group: 'Keywords & research', rows: [
    { label: 'Keyword searches', cells: ['5 / day', '500 / day', 'Unlimited', 'Unlimited', 'Unlimited'] },
    { label: 'Keyword metrics (volume, KD, competition)', cells: ['Basic', true, true, true, true] },
    { label: 'Competitor tracking', cells: [false, true, true, true, true] },
    { label: 'Trend Finder', cells: [false, false, true, true, true] },
    { label: 'Product research', cells: [false, false, true, true, true] },
    { label: 'Keyword / rank tracking', cells: [false, false, true, true, true] },
  ] },
  { group: 'Listings & AI', rows: [
    { label: 'Listing audit', cells: ['Limited', true, true, true, true] },
    { label: 'Listing optimization', cells: [false, true, true, true, true] },
    { label: 'Tag generator', cells: [false, true, true, true, true] },
    { label: 'AI Listing Generator', cells: [false, 'Basic', true, true, true] },
    { label: 'Shop Audit', cells: [false, false, true, true, true] },
    { label: 'CSV export', cells: [false, false, true, true, true] },
  ] },
  { group: 'Shops & team', rows: [
    { label: 'Shop analytics', cells: ['Basic', true, true, 'Advanced', 'Advanced'] },
    { label: 'Multi-shop support', cells: [false, false, false, true, 'Unlimited'] },
    { label: 'Team members', cells: [false, false, false, true, true] },
    { label: 'Bulk listing optimization', cells: [false, false, false, true, true] },
  ] },
  { group: 'Agency & support', rows: [
    { label: 'White-label reports', cells: [false, false, false, false, true] },
    { label: 'Client dashboard', cells: [false, false, false, false, true] },
    { label: 'Support', cells: ['Community', 'Email', 'Email', 'Priority', 'Dedicated'] },
  ] },
]
