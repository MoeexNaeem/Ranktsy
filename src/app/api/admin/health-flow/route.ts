import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { connectDB } from '@/lib/db'
import { etsyKeyPoolSize, probeEtsyKeys, etsyEndpointUsage } from '@/lib/etsy'
import { isGeminiConfigured, geminiKeyPoolSize } from '@/lib/gemini'
import { isGoogleAdsConfigured, googleAdsStatus, recheckGoogleAdsQuota } from '@/lib/google-ads'
import { isRecaptchaConfigured } from '@/lib/recaptcha'
import type { FlowSystem } from '@/lib/codeflow/graph'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Live health of every subsystem the Code Flow diagram colours by.
 *
 *   status 'ok'   → green   (working / configured)
 *   status 'down' → red     (REQUIRED system missing or unreachable → things break)
 *   status 'off'  → amber   (OPTIONAL system not configured → that feature is dormant)
 *
 * Cheap and side-effect-free: it never spends an Etsy/Google/Gemini call. External
 * providers are reported as configured-or-not (a key exists), except Mongo which is
 * pinged for real since a dead DB is the one that silently breaks everything.
 */
type Status = 'ok' | 'down' | 'off'
interface SystemHealth { status: Status; required: boolean; detail: string }

const env = (k: string) => (process.env[k] ?? '').trim().length > 0

async function pingMongo(): Promise<SystemHealth> {
  try {
    await connectDB()
    const db = mongoose.connection.db
    if (!db) return { status: 'down', required: true, detail: 'No DB handle' }
    const t = Date.now()
    await db.admin().ping()
    const ms = Date.now() - t
    return { status: 'ok', required: true, detail: `ping ${ms}ms${ms > 400 ? ' (slow tier)' : ''}` }
  } catch (e) {
    return { status: 'down', required: true, detail: e instanceof Error ? e.message.slice(0, 120) : 'unreachable' }
  }
}

export async function GET(): Promise<NextResponse<ApiResponse<{ systems: Record<FlowSystem, SystemHealth>; checkedAt: string }>>> {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const mongo = await pingMongo()

  // Live-probe each Etsy key so a bad/misconfigured one is caught (a single bad
  // key silently fails ~half of all Etsy requests). All keys good = ok; some bad
  // = down (it IS breaking requests); none configured = down.
  const etsyKeys = etsyKeyPoolSize()
  const probes = etsyKeys > 0 ? await probeEtsyKeys().catch(() => []) : []
  const goodKeys = probes.filter(p => p.ok).length
  const badKeys = probes.filter(p => !p.ok)
  // A 429 is Etsy's DAILY quota (10k/day per key), not a broken key: say so plainly.
  const quotaKeys = badKeys.filter(b => b.status === 429)
  const reset = probes.map(p => p.retryAt).filter((x): x is string => !!x).sort()[0]
  const usage = etsyEndpointUsage(4).map(u => `${u.endpoint} ${u.calls}`).join(', ')
  const quotaNote = quotaKeys.length
    ? `daily Etsy limit reached on key ${quotaKeys.map(q => `#${q.index}`).join(', ')}${reset ? ` (resets ~${reset.slice(11, 16)} UTC)` : ''} - add more Etsy app keys or ask Etsy for a higher limit${usage ? `; top endpoints (this worker): ${usage}` : ''}`
    : ''
  const etsyHealth: SystemHealth =
    etsyKeys === 0 ? { status: 'down', required: true, detail: 'no Etsy key configured' }
    : quotaKeys.length && quotaKeys.length === badKeys.length
      ? { status: goodKeys === 0 ? 'down' : 'off', required: true, detail: goodKeys === 0 ? `all keys out of quota: ${quotaNote}` : `${goodKeys}/${etsyKeys} keys ok; ${quotaNote}` }
    : probes.length === 0 ? { status: 'ok', required: true, detail: `${etsyKeys} key${etsyKeys === 1 ? '' : 's'} (probe skipped)` }
    : goodKeys === 0 ? { status: 'down', required: true, detail: `all ${etsyKeys} keys failing (${badKeys.map(b => `#${b.index}:${b.status ?? 'err'}`).join(', ')})` }
    : badKeys.length > 0 ? { status: 'down', required: true, detail: `key ${badKeys.map(b => `#${b.index} (${b.status ?? 'err'})`).join(', ')} failing - fix or remove it; ${goodKeys}/${etsyKeys} ok` }
    : { status: 'ok', required: true, detail: `${goodKeys}/${etsyKeys} keys ok` }

  const lsOk = env('LS_API_KEY') && env('LS_WEBHOOK_SECRET')
  // Google Ads Basic Access = 15,000 ops/day for the whole app; when exhausted every
  // Google panel (volume, trends, countries, ideas) blanks until Google's retry time.
  // While locked, the app re-checks Google itself every 15 min and resumes on success.
  const gads = await googleAdsStatus().catch(() => ({ configured: isGoogleAdsConfigured(), quotaBlocked: false, retryAt: null as string | null, reason: null as string | null, nextCheckAt: null as string | null }))
  const hhmm = (iso: string | null) => iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : '?'
  const googleHealth: SystemHealth = !gads.configured
    ? { status: 'off', required: false, detail: 'no key - search volume blank' }
    : gads.quotaBlocked
      ? { status: 'down', required: false, detail: `paused after a Google quota 429${gads.reason ? ` (${gads.reason})` : ''}. Next automatic re-check ${hhmm(gads.nextCheckAt)}, lock ends ${hhmm(gads.retryAt)}. Cached data is still served.` }
      : { status: 'ok', required: false, detail: 'configured (answers cached 30 days)' }

  const systems: Record<FlowSystem, SystemHealth> = {
    mongo,
    auth:  { status: env('JWT_SECRET') && env('JWT_REFRESH_SECRET') ? 'ok' : 'down', required: true,
             detail: env('JWT_SECRET') && env('JWT_REFRESH_SECRET') ? 'secrets set' : 'JWT secrets missing' },
    etsy:  etsyHealth,
    gemini:       { status: isGeminiConfigured()   ? 'ok' : 'off', required: false, detail: isGeminiConfigured()   ? `${geminiKeyPoolSize()} key${geminiKeyPoolSize() === 1 ? '' : 's'} in pool` : 'no key - AI tools dormant' },
    google:       googleHealth,
    openai:       { status: env('OPENAI_API_KEY')  ? 'ok' : 'off', required: false, detail: env('OPENAI_API_KEY')  ? 'configured' : 'no key - Listing Pro image off' },
    lemonsqueezy: { status: lsOk                    ? 'ok' : 'off', required: false, detail: lsOk ? 'configured' : 'checkout/webhook keys missing' },
    resend:       { status: env('RESEND_API_KEY')  ? 'ok' : 'off', required: false, detail: env('RESEND_API_KEY')  ? 'configured' : 'no key - OTP emails off' },
    recaptcha:    { status: isRecaptchaConfigured() ? 'ok' : 'off', required: false, detail: isRecaptchaConfigured() ? 'configured' : 'dormant (no keys)' },
    redis:        { status: env('UPSTASH_REDIS_REST_URL') && env('UPSTASH_REDIS_REST_TOKEN') ? 'ok' : 'off', required: false,
                    detail: env('UPSTASH_REDIS_REST_URL') && env('UPSTASH_REDIS_REST_TOKEN') ? 'configured' : 'per-worker cache only' },
  }

  return NextResponse.json({ success: true, data: { systems, checkedAt: new Date().toISOString() } })
}

/**
 * Admin "Re-check Google now": spends ONE Google Ads operation (a 1-row customer query)
 * to see whether the quota lock is still real. Clears it on success.
 */
export async function POST(): Promise<NextResponse<ApiResponse<{ ok: boolean; message: string }>>> {
  const auth = await getCurrentUser().catch(() => null)
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  const result = await recheckGoogleAdsQuota()
  return NextResponse.json({ success: true, data: result })
}
