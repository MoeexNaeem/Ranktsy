import { NextRequest, NextResponse } from 'next/server'
import { resolveTxt } from 'node:dns/promises'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { User, ApiUsage } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { securityCollection, logFromRequest, requestContext } from '@/lib/security/events'
import { SECURITY_EVENTS, SECURITY_TYPES, type SecurityEventType } from '@/lib/security/catalog'
import { blockIp, unblockIp, listIpBlocks, blockedIps } from '@/lib/security/ipBlock'
import { buildUserFilter } from '@/lib/admin/userFilters'
import { PENDING_SIGNUP, NOT_PENDING_SIGNUP } from '@/lib/auth/pendingSignups'
import { disposableDomainCount } from '@/lib/auth/disposable'
import { isRecaptchaConfigured } from '@/lib/recaptcha'
import { getMaintenance } from '@/lib/maintenance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HOUR = 3_600_000
const DAY = 24 * HOUR

async function requireAdmin() {
  const auth = await getCurrentUser()
  if (!auth) return { res: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), auth: null }
  if (!isAdmin(auth)) return { res: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), auth: null }
  return { res: null, auth }
}

/** Page number + size from the query (size capped), and the skip for it. */
function paging(sp: URLSearchParams, size: number) {
  const page = Math.max(1, Number(sp.get('page')) || 1)
  return { page, limit: size, skip: (page - 1) * size }
}
const pageOut = <T,>(rows: T[], total: number, page: number, limit: number) =>
  ({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) })

const sinceFor = (range: string | null) => new Date(Date.now() - (range === '7d' ? 7 * DAY : range === '1h' ? HOUR : DAY))

/**
 * Admin Security section.
 *   GET ?view=overview|events|ips|accounts|health  (&range=1h|24h|7d)
 *   POST { action: 'block' | 'unblock', ip, reason?, hours? }
 */
export async function GET(req: NextRequest) {
  const { res } = await requireAdmin()
  if (res) return res
  await connectDB()
  const sp = new URL(req.url).searchParams
  const view = sp.get('view') ?? 'overview'
  const since = sinceFor(sp.get('range'))
  const col = await securityCollection()

  if (view === 'overview') {
    const now = Date.now()
    const [byType, timeline, topIps, countries, recentHigh, lastHourHigh, blocked, restricted, tempMail, pending, signupFarms] = await Promise.all([
      col.aggregate<{ _id: string; n: number; ips: string[] }>([
        { $match: { last: { $gte: since } } },
        { $group: { _id: '$type', n: { $sum: '$count' }, ips: { $addToSet: '$ip' } } },
      ]).toArray(),
      col.aggregate<{ _id: { h: string; s: string }; n: number }>([
        { $match: { last: { $gte: new Date(now - DAY) } } },
        { $group: { _id: { h: { $dateToString: { format: '%Y-%m-%dT%H', date: '$last' } }, s: '$severity' }, n: { $sum: '$count' } } },
      ]).toArray(),
      col.aggregate<{ _id: string; n: number; high: number; types: string[]; emails: string[]; country: string | null; last: Date }>([
        { $match: { last: { $gte: since }, ip: { $ne: 'unknown' }, type: { $ne: 'admin_action' } } },
        { $group: {
          _id: '$ip', n: { $sum: '$count' },
          high: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, '$count', 0] } },
          types: { $addToSet: '$type' }, emails: { $addToSet: '$email' },
          country: { $max: '$country' }, last: { $max: '$last' },
        } },
        { $sort: { high: -1, n: -1 } }, { $limit: 10 },
      ]).toArray(),
      col.aggregate<{ _id: string | null; n: number }>([
        { $match: { last: { $gte: since }, type: { $ne: 'admin_action' } } },
        { $group: { _id: '$country', n: { $sum: '$count' } } }, { $sort: { n: -1 } }, { $limit: 8 },
      ]).toArray(),
      col.find({ last: { $gte: since }, severity: 'high' }).sort({ last: -1 }).limit(8).toArray(),
      col.aggregate<{ n: number }>([{ $match: { last: { $gte: new Date(now - HOUR) }, severity: 'high' } }, { $group: { _id: null, n: { $sum: '$count' } } }]).toArray(),
      blockedIps(),
      User.countDocuments({ restricted: true }),
      buildUserFilter({ emailType: 'temp' }).then(f => User.countDocuments(f)),
      User.countDocuments(PENDING_SIGNUP),
      User.aggregate<{ _id: string; n: number }>([
        { $match: { signupIp: { $ne: null }, createdAt: { $gte: new Date(now - 7 * DAY) } } },
        { $group: { _id: '$signupIp', n: { $sum: 1 } } }, { $match: { n: { $gte: 3 } } }, { $count: 'n' },
      ]),
    ])
    const counts = Object.fromEntries(byType.map(t => [t._id, { n: t.n, ips: t.ips.length }]))
    const sev = { info: 0, warn: 0, high: 0 } as Record<string, number>
    for (const t of byType) sev[SECURITY_EVENTS[t._id as SecurityEventType]?.severity ?? 'info'] += t.n
    const hours: { hour: string; info: number; warn: number; high: number }[] = []
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now - i * HOUR).toISOString().slice(0, 13)
      const pick = (s: string) => timeline.find(t => t._id.h === h && t._id.s === s)?.n ?? 0
      hours.push({ hour: h, info: pick('info'), warn: pick('warn'), high: pick('high') })
    }
    const highLastHour = lastHourHigh[0]?.n ?? 0
    const level = highLastHour >= 50 ? 'under attack' : highLastHour > 0 || sev.high > 20 ? 'elevated' : 'normal'
    return NextResponse.json({ success: true, data: {
      level, highLastHour, severity: sev, counts, hours,
      topIps: topIps.map(t => ({ ip: t._id, n: t.n, high: t.high, types: t.types, emails: t.emails.filter(Boolean).slice(0, 5), country: t.country, last: t.last, blocked: blocked.has(t._id) })),
      countries: countries.map(c => ({ country: c._id ?? '??', n: c.n })),
      recentHigh,
      totals: { blockedIps: blocked.size, restricted, tempMail, pending, signupFarms: signupFarms[0]?.n ?? 0 },
    } })
  }

  if (view === 'events') {
    const { page, limit, skip } = paging(sp, 25)
    const match: Record<string, unknown> = { last: { $gte: since } }
    const type = sp.get('type'); if (type && (SECURITY_TYPES as string[]).includes(type)) match.type = type
    const severity = sp.get('severity'); if (severity === 'info' || severity === 'warn' || severity === 'high') match.severity = severity
    const ip = sp.get('ip'); if (ip) match.ip = ip
    const q = (sp.get('q') || '').trim().toLowerCase()
    if (q) match.$or = [{ email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }, { ip: q }]
    const [total, rows] = await Promise.all([
      col.countDocuments(match),
      col.find(match).sort({ last: -1 }).skip(skip).limit(limit).toArray(),
    ])
    return NextResponse.json({ success: true, data: pageOut(rows, total, page, limit) })
  }

  if (view === 'ips') {
    const { page, limit, skip } = paging(sp, 20)
    const [facet] = await col.aggregate<{ rows: { _id: string; n: number; high: number; warn: number; types: string[]; emails: string[]; country: string | null; first: Date; last: Date }[]; total: { n: number }[] }>([
      { $match: { last: { $gte: since }, ip: { $ne: 'unknown' }, type: { $ne: 'admin_action' } } },
      { $group: {
        _id: '$ip', n: { $sum: '$count' },
        high: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, '$count', 0] } },
        warn: { $sum: { $cond: [{ $eq: ['$severity', 'warn'] }, '$count', 0] } },
        types: { $addToSet: '$type' }, emails: { $addToSet: '$email' },
        country: { $max: '$country' }, first: { $min: '$first' }, last: { $max: '$last' },
      } },
      { $sort: { high: -1, warn: -1, n: -1, _id: 1 } },
      { $facet: { rows: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
    ]).toArray()
    const rows = facet?.rows ?? []
    const [signups, blocked] = await Promise.all([
      User.aggregate<{ _id: string; n: number }>([
        { $match: { signupIp: { $in: rows.map(r => r._id) } } }, { $group: { _id: '$signupIp', n: { $sum: 1 } } },
      ]),
      blockedIps(),
    ])
    const signupsBy = new Map(signups.map(x => [x._id, x.n]))
    return NextResponse.json({ success: true, data: pageOut(
      rows.map(r => ({ ip: r._id, n: r.n, high: r.high, warn: r.warn, types: r.types, emails: r.emails.filter(Boolean).slice(0, 8), country: r.country, first: r.first, last: r.last, accounts: signupsBy.get(r._id) ?? 0, blocked: blocked.has(r._id) })),
      facet?.total[0]?.n ?? 0, page, limit,
    ) })
  }

  if (view === 'blocks') {
    const { page, limit, skip } = paging(sp, 10)
    const all = await listIpBlocks()
    return NextResponse.json({ success: true, data: pageOut(all.slice(skip, skip + limit), all.length, page, limit) })
  }

  if (view === 'accounts') {
    const list = sp.get('list') ?? 'farms'
    const { page, limit, skip } = paging(sp, 8)
    if (list === 'farms') {
      const [facet] = await User.aggregate<{ rows: { _id: string; n: number; emails: string[]; last: Date }[]; total: { n: number }[] }>([
        { $match: { signupIp: { $ne: null } } },
        { $group: { _id: '$signupIp', n: { $sum: 1 }, emails: { $push: '$email' }, last: { $max: '$createdAt' } } },
        { $match: { n: { $gte: 2 } } }, { $sort: { n: -1, last: -1 } },
        { $facet: { rows: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
      ])
      return NextResponse.json({ success: true, data: pageOut((facet?.rows ?? []).map(f => ({ ip: f._id, n: f.n, emails: f.emails.slice(0, 10), last: f.last })), facet?.total[0]?.n ?? 0, page, limit) })
    }
    if (list === 'heavy') {
      const day = new Date().toISOString().slice(0, 10)
      const match = { day, etsyCalls: { $gt: 0 } }
      const [rows, total] = await Promise.all([
        ApiUsage.find(match).sort({ etsyCalls: -1 }).skip(skip).limit(limit).select('userEmail userId etsyCalls searches googleCalls').lean(),
        ApiUsage.countDocuments(match),
      ])
      return NextResponse.json({ success: true, data: pageOut(rows, total, page, limit) })
    }
    if (list === 'targeted') {
      const [facet] = await col.aggregate<{ rows: { _id: string; n: number; ips: string[]; last: Date }[]; total: { n: number }[] }>([
        { $match: { type: { $in: ['login_failed', 'login_rate_limited'] }, email: { $ne: null }, last: { $gte: new Date(Date.now() - 7 * DAY) } } },
        { $group: { _id: '$email', n: { $sum: '$count' }, ips: { $addToSet: '$ip' }, last: { $max: '$last' } } },
        { $sort: { n: -1 } },
        { $facet: { rows: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
      ]).toArray()
      return NextResponse.json({ success: true, data: pageOut((facet?.rows ?? []).map(t => ({ email: t._id, n: t.n, ips: t.ips.slice(0, 5), last: t.last })), facet?.total[0]?.n ?? 0, page, limit) })
    }
    if (list === 'restricted') {
      const [rows, total] = await Promise.all([
        User.find({ restricted: true }).select('email name plan createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments({ restricted: true }),
      ])
      return NextResponse.json({ success: true, data: pageOut(rows, total, page, limit) })
    }
    return NextResponse.json({ success: false, error: 'Unknown list' }, { status: 400 })
  }

  if (view === 'health') {
    const ctx = requestContext(req)
    const txt = async (name: string) => {
      try {
        const r = await Promise.race([resolveTxt(name), new Promise<null>(r2 => setTimeout(() => r2(null), 3000))])
        return r ? r.map(x => x.join('')) : null
      } catch { return [] }
    }
    const [spf, dkimPe, dkimResend, dmarc, maint, resendToday, realUsers] = await Promise.all([
      txt('rankkw.com'), txt('privateemail._domainkey.rankkw.com'), txt('resend._domainkey.rankkw.com'), txt('_dmarc.rankkw.com'),
      getMaintenance(),
      mongoose.connection.db!.collection<{ _id: string; n: number }>('emailsends').findOne({ _id: `resend|${new Date().toISOString().slice(0, 10)}` }),
      User.countDocuments(NOT_PENDING_SIGNUP),
    ])
    type Check = { id: string; label: string; status: 'ok' | 'warn' | 'bad' | 'manual'; detail: string; fix?: string }
    const checks: Check[] = [
      { id: 'cloudflare', label: 'Traffic goes through Cloudflare', status: ctx.country || req.headers.get('cf-ray') ? 'ok' : 'warn',
        detail: req.headers.get('cf-ray') ? `Yes (this request came via Cloudflare, country ${ctx.country ?? '?'})` : 'This request did not come through Cloudflare.',
        fix: 'Keep the orange cloud ON for rankkw.com in Cloudflare DNS so attackers never see the real server.' },
      { id: 'origin', label: 'Server only accepts Cloudflare (origin firewall)', status: 'manual',
        detail: 'Cannot be checked from inside the app. If the server IP is open to everyone, attackers can skip Cloudflare.',
        fix: 'In aaPanel Security (or the server firewall), allow ports 80/443 only from Cloudflare IP ranges (cloudflare.com/ips). Ask me for the exact commands.' },
      { id: 'ssh', label: 'Server login (SSH) protected', status: 'manual',
        detail: 'Your server showed 127+ failed SSH logins (password guessing).',
        fix: 'In aaPanel: change the SSH port, install Fail2ban, use a long random root password (or SSH keys only).' },
      { id: 'recaptcha', label: 'Robot check (reCAPTCHA) on login, signup and search', status: isRecaptchaConfigured() ? 'ok' : 'bad',
        detail: isRecaptchaConfigured() ? 'Configured.' : 'reCAPTCHA keys are missing: bots can log in / sign up without a check.',
        fix: 'Set RECAPTCHA keys in .env.local. Also enable billing for reCAPTCHA (free tier is 10k checks/month).' },
      { id: 'tempmail', label: 'Throwaway email domains blocked at signup', status: 'ok',
        detail: `${disposableDomainCount().toLocaleString('en-US')} domains on the block list.`,
        fix: 'Refresh the list every month or two: node scripts/update-disposable-domains.mjs, then deploy.' },
      { id: 'verify', label: 'New signups must confirm their email', status: 'ok', detail: 'A 6-digit code is required before an email/password account opens.' },
      { id: 'spf', label: 'Email SPF record', status: spf === null ? 'warn' : spf.some(t => t.startsWith('v=spf1')) ? 'ok' : 'bad',
        detail: spf?.find(t => t.startsWith('v=spf1')) ?? 'No SPF record found.', fix: 'Add a TXT record on rankkw.com: v=spf1 include:spf.privateemail.com ~all' },
      { id: 'dkim', label: 'Email signature (DKIM) for backup emails', status: dkimPe?.length ? 'ok' : 'bad',
        detail: dkimPe?.length ? 'Private Email DKIM record found.' : 'No DKIM for Private Email: backup (Gmail/Namecheap) emails land in spam.',
        fix: 'Namecheap > Private Email > Manage > DKIM > Generate, then add TXT record host privateemail._domainkey with that value.' },
      { id: 'dkim-resend', label: 'Email signature (DKIM) for Resend', status: dkimResend?.length ? 'ok' : 'bad',
        detail: dkimResend?.length ? 'Resend DKIM record found.' : 'Missing.', fix: 'Re-add the resend._domainkey record from the Resend dashboard.' },
      { id: 'dmarc', label: 'DMARC policy', status: dmarc?.some(t => t.startsWith('v=DMARC1')) ? 'ok' : 'warn',
        detail: dmarc?.find(t => t.startsWith('v=DMARC1')) ?? 'No DMARC record: other people can send email pretending to be @rankkw.com.',
        fix: 'Add TXT record host _dmarc: v=DMARC1; p=none; rua=mailto:support@rankkw.com (later p=quarantine).' },
      { id: 'resend', label: 'Email sending capacity today', status: (resendToday?.n ?? 0) > 95 ? 'warn' : 'ok',
        detail: `${resendToday?.n ?? 0} of 95 free Resend emails used today${(resendToday?.n ?? 0) > 95 ? ', now sending through the Gmail backup' : ''}. Gmail backup: ${process.env.SMTP_USER ? 'configured' : 'NOT configured'}.`,
        fix: 'Resend Pro (about $20/month) removes the daily limit.' },
      { id: 'admins', label: 'Admin accounts locked to ADMIN_EMAILS', status: process.env.ADMIN_EMAILS ? 'ok' : 'warn',
        detail: process.env.ADMIN_EMAILS ? `${process.env.ADMIN_EMAILS.split(',').filter(Boolean).length} admin email(s) configured.` : 'ADMIN_EMAILS not set.' },
      { id: 'maintenance', label: 'Maintenance mode', status: maint.on ? 'warn' : 'ok', detail: maint.on ? 'ON: the site is closed to users.' : 'Off.' },
      { id: 'secrets', label: 'Leaked passwords and keys rotated', status: 'manual',
        detail: 'The Gmail app password and some API keys were shared in chat/screenshots earlier.',
        fix: 'Create a new Gmail app password and update SMTP_PASS; rotate any keys that appeared in screenshots.' },
      { id: 'atlas', label: 'Database only reachable from your server', status: 'manual',
        detail: 'Cannot be checked from the app.', fix: 'MongoDB Atlas > Network Access: allow only the server IP (91.230.110.11), remove 0.0.0.0/0 if present.' },
      { id: 'backups', label: 'Database backups', status: 'manual', detail: `Atlas M10 has cloud backups; ${realUsers.toLocaleString('en-US')} user accounts depend on them.`, fix: 'Atlas > Backup: confirm snapshots are on and test a restore once.' },
    ]
    return NextResponse.json({ success: true, data: { checks } })
  }

  return NextResponse.json({ success: false, error: 'Unknown view' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const { res, auth } = await requireAdmin()
  if (res || !auth) return res
  const body = await req.json().catch(() => ({})) as { action?: string; ip?: string; reason?: string; hours?: number }
  const ip = String(body.ip ?? '').trim()
  if (!/^[0-9a-fA-F:.]{3,64}$/.test(ip)) return NextResponse.json({ success: false, error: 'Enter a valid IP address.' }, { status: 400 })
  if (body.action === 'block') {
    if (ip === requestContext(req).ip) return NextResponse.json({ success: false, error: 'That is your own current IP address. Blocking it would lock you out.' }, { status: 400 })
    await blockIp(ip, body.reason?.trim() || 'Blocked from the Security section', auth.email, body.hours ?? null)
    logFromRequest('admin_action', req, { userId: auth.id, email: auth.email, detail: `blocked IP ${ip}${body.hours ? ` for ${body.hours}h` : ''}` })
    return NextResponse.json({ success: true })
  }
  if (body.action === 'unblock') {
    await unblockIp(ip)
    logFromRequest('admin_action', req, { userId: auth.id, email: auth.email, detail: `unblocked IP ${ip}` })
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
}
