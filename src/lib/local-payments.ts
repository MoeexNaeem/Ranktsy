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
  { slug: 'pro-1yr',    label: 'Pro · 1-Year', usd: '$99.99', pkr: 27600,  months: 12, period: 'per year' },
  { slug: 'business',   label: 'Business',     usd: '$19.99', pkr: 5500,   months: 1,  period: 'per month' },
  { slug: 'agency',     label: 'Agency',       usd: '$39.99', pkr: 11000,  months: 1,  period: 'per month' },
  { slug: 'enterprise', label: 'Enterprise',   usd: '$49.99', pkr: 13800,  months: 1,  period: 'per month' },
]

export const localPlanFor = (slug: string): LocalPlan | undefined => LOCAL_PLANS.find(p => p.slug === slug)

export const formatPkr = (n: number) => `Rs ${n.toLocaleString('en-PK')}`

export interface LocalAccount {
  method: LocalMethod
  label: string
  rows: { label: string; value: string; copy?: boolean }[]
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
  jazzcash: {
    method: 'jazzcash',
    label: 'JazzCash',
    rows: [
      { label: 'JazzCash number', value: '03028181216', copy: true },
      { label: 'Account title', value: 'Letrank Marketing', copy: true },
    ],
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
export function addMonths(months: number, from: Date = new Date()): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + months)
  return d
}
