/**
 * Local (Pakistan) payments: bank transfer or JazzCash, verified by an admin from a
 * payment screenshot. Client-safe: plain data only (the page, the admin panel and the
 * API routes all read the same prices and account details from here).
 *
 * Flow: user picks a method and a plan on /local-payment → pays → uploads proof →
 * request is 'pending' → an admin approves (grants the plan with a compExpiresAt, so
 * it reverts to Free exactly when the paid period ends) or rejects.
 */
import type { PlanSlug } from '@/lib/plans'

export type LocalMethod = 'bank' | 'jazzcash'
export type LocalStatus = 'pending' | 'approved' | 'rejected'

export interface LocalPlan {
  slug: PlanSlug
  label: string
  usd: string
  pkr: number
  /** How long an approved payment grants the plan for. */
  months: number
  period: string
}

// Prices as set by Rankkw (2026-09-26). Order = cheapest first.
export const LOCAL_PLANS: LocalPlan[] = [
  { slug: 'starter',    label: 'Starter',      usd: '$0.99',  pkr: 270,    months: 1,  period: 'per month' },
  { slug: 'basic',      label: 'Basic',        usd: '$2.99',  pkr: 820,    months: 1,  period: 'per month' },
  { slug: 'pro',        label: 'Pro',          usd: '$6.99',  pkr: 1940,   months: 1,  period: 'per month' },
  { slug: 'pro-1yr',    label: 'Pro · 1-Year', usd: '$49.99', pkr: 14000,  months: 12, period: 'per year' },
  { slug: 'business',   label: 'Business',     usd: '$19.99', pkr: 5500,   months: 1,  period: 'per month' },
  { slug: 'agency',     label: 'Agency',       usd: '$39.99', pkr: 11000,  months: 1,  period: 'per month' },
  { slug: 'enterprise', label: 'Enterprise',   usd: '$49.99', pkr: 13800,  months: 1,  period: 'per month' },
]

export const localPlanFor = (slug: string): LocalPlan | undefined => LOCAL_PLANS.find(p => p.slug === slug)

export const formatPkr = (n: number) => `Rs ${n.toLocaleString('en-PK')}`

export interface LocalAccount {
  method: LocalMethod
  label: string
  rows: { label: string; value: string; copy?: boolean; big?: boolean }[]
  /** Payment QR shown large on the payment step (e.g. a JazzCash Raast till code). */
  qr?: { src: string; download: string; alt: string; caption: string }
}

export const LOCAL_ACCOUNTS: Record<LocalMethod, LocalAccount> = {
  bank: {
    method: 'bank',
    label: 'Bank transfer',
    rows: [
      { label: 'Bank', value: 'Allied Bank' },
      { label: 'Account title', value: 'Letrank Marketing', copy: true },
      { label: 'Account number', value: '00400010135230250014', copy: true },
      { label: 'IBAN', value: 'PK17ABPA0010135230250014', copy: true },
    ],
  },
  // Till payment (JazzCash / Raast QR) since 2026-10-06; was mobile number 03028181216.
  jazzcash: {
    method: 'jazzcash',
    label: 'JazzCash',
    rows: [
      { label: 'Account name', value: 'ZAFAR Shop', copy: true },
      { label: 'Till ID', value: '984605348', copy: true, big: true },
    ],
    qr: {
      src: '/payments/jazzcash-qr.png',
      download: '/payments/jazzcash-qr-poster.jpg',
      alt: 'JazzCash Raast QR code for ZAFAR Shop, Till ID 984605348',
      caption: 'Scan with the JazzCash app (or any Raast banking app)',
    },
  },
}

export const METHOD_LABELS: Record<LocalMethod, string> = { bank: 'Bank transfer', jazzcash: 'JazzCash' }
export const STATUS_LABELS: Record<LocalStatus, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }

// Payment proof: a screenshot (image) or a PDF receipt, kept small (stored in Mongo).
export const PROOF_MAX_BYTES = 4 * 1024 * 1024
export const PROOF_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf'
const PROOF_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'])

export function validateProof(type: string, size: number): { ok: boolean; error?: string } {
  if (!PROOF_TYPES.has((type || '').toLowerCase())) return { ok: false, error: 'Upload a screenshot (PNG, JPG or WebP) or a PDF receipt.' }
  if (!size) return { ok: false, error: 'That file appears to be empty.' }
  if (size > PROOF_MAX_BYTES) return { ok: false, error: 'That file is too large. The maximum size is 4 MB.' }
  return { ok: true }
}

/** Plan end for an approval: `months` calendar months from `from`. */
/** How long an admin grant of `plan` lasts: its own period (Pro · 1-Year = 12 months), else 1 month. */
export const grantMonthsFor = (plan: string): number => localPlanFor(plan)?.months ?? 1

export function addMonths(months: number, from: Date = new Date()): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + months)
  return d
}
