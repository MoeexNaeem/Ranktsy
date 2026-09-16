import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { connectDB } from '@/lib/db'
import { etsyKeyPoolSize, probeEtsyKeys } from '@/lib/etsy'
import { isGeminiConfigured, geminiKeyPoolSize } from '@/lib/gemini'
import { isGoogleAdsConfigured } from '@/lib/google-ads'
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
  const etsyHealth: SystemHealth =
    etsyKeys === 0 ? { status: 'down', required: true, detail: 'no Etsy key configured' }
    : probes.length === 0 ? { status: 'ok', required: true, detail: `${etsyKeys} key${etsyKeys === 1 ? '' : 's'} (probe skipped)` }
    : goodKeys === 0 ? { status: 'down', required: true, detail: `all ${etsyKeys} keys failing (${badKeys.map(b => `#${b.index}:${b.status ?? 'err'}`).join(', ')})` }
    : badKeys.length > 0 ? { status: 'down', required: true, detail: `key ${badKeys.map(b => `#${b.index} (${b.status ?? 'err'})`).join(', ')} failing - fix or remove it; ${goodKeys}/${etsyKeys} ok` }
    : { status: 'ok', required: true, detail: `${goodKeys}/${etsyKeys} keys ok` }

  const lsOk = env('LS_API_KEY') && env('LS_WEBHOOK_SECRET')

  const systems: Record<FlowSystem, SystemHealth> = {
    mongo,
    auth:  { status: env('JWT_SECRET') && env('JWT_REFRESH_SECRET') ? 'ok' : 'down', required: true,
             detail: env('JWT_SECRET') && env('JWT_REFRESH_SECRET') ? 'secrets set' : 'JWT secrets missing' },
    etsy:  etsyHealth,
    gemini:       { status: isGeminiConfigured()   ? 'ok' : 'off', required: false, detail: isGeminiConfigured()   ? `${geminiKeyPoolSize()} key${geminiKeyPoolSize() === 1 ? '' : 's'} in pool` : 'no key - AI tools dormant' },
    google:       { status: isGoogleAdsConfigured()? 'ok' : 'off', required: false, detail: isGoogleAdsConfigured()? 'configured' : 'no key - search volume blank' },
    openai:       { status: env('OPENAI_API_KEY')  ? 'ok' : 'off', required: false, detail: env('OPENAI_API_KEY')  ? 'configured' : 'no key - Listing Pro image off' },
    lemonsqueezy: { status: lsOk                    ? 'ok' : 'off', required: false, detail: lsOk ? 'configured' : 'checkout/webhook keys missing' },
    resend:       { status: env('RESEND_API_KEY')  ? 'ok' : 'off', required: false, detail: env('RESEND_API_KEY')  ? 'configured' : 'no key - OTP emails off' },
    recaptcha:    { status: isRecaptchaConfigured() ? 'ok' : 'off', required: false, detail: isRecaptchaConfigured() ? 'configured' : 'dormant (no keys)' },
    redis:        { status: env('UPSTASH_REDIS_REST_URL') && env('UPSTASH_REDIS_REST_TOKEN') ? 'ok' : 'off', required: false,
                    detail: env('UPSTASH_REDIS_REST_URL') && env('UPSTASH_REDIS_REST_TOKEN') ? 'configured' : 'per-worker cache only' },
  }

  return NextResponse.json({ success: true, data: { systems, checkedAt: new Date().toISOString() } })
}
