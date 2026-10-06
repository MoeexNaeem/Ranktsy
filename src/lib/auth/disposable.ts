import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DISPOSABLE_EMAIL_DOMAINS } from '@/lib/auth/schemas'

/**
 * Throwaway / temporary email domains, blocked at signup (server-side, so it can't
 * be skipped). Temp-mail sites CAN receive our verification code, so the code step
 * alone does not stop them (2026-10-07: dozens of signups on necub.com, hudzer.com,
 * bitproy.com...). ~98,000 domains from two maintained public lists plus domains
 * seen abusing Rankkw, in data/disposable-domains.txt. Server-only (reads a file).
 */
const g = globalThis as typeof globalThis & { __rkDisposable?: Set<string> }

function domains(): Set<string> {
  if (g.__rkDisposable) return g.__rkDisposable
  const set = new Set<string>(DISPOSABLE_EMAIL_DOMAINS)
  try {
    const text = readFileSync(join(process.cwd(), 'data', 'disposable-domains.txt'), 'utf8')
    for (const line of text.split('\n')) {
      const d = line.trim()
      if (d && !d.startsWith('#')) set.add(d)
    }
  } catch (e) {
    console.error('[disposable] could not read data/disposable-domains.txt:', e instanceof Error ? e.message : e)
  }
  g.__rkDisposable = set
  return set
}

/** True when the address (or any parent of its domain) is a known throwaway provider. */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (!domain) return false
  const set = domains()
  const parts = domain.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    if (set.has(parts.slice(i).join('.'))) return true
  }
  return false
}
