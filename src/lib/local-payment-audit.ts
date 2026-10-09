/**
 * Local payment audit (admin → Earnings → Local payments): every bank / JazzCash
 * payment, filtered by customer, plan, status, method and date, with the proof
 * screenshot, so the owner can match them against the bank statement. Exports to
 * CSV and to a PDF that embeds each screenshot.
 *
 * Three automatic warning flags help spot fakes:
 *   - the same Transaction ID on more than one payment
 *   - the same screenshot (byte-identical) uploaded more than once
 *   - an amount different from the plan's listed price
 * Dates are Pakistan time (Asia/Karachi), like the bank statement.
 */
import { createHash } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { connectDB } from '@/lib/db'
import { LocalPayment } from '@/lib/models'
import { memCache } from '@/lib/cache'
import { localPlanFor, LOCAL_PLANS } from '@/lib/local-payments'

export type AuditStatus = 'approved' | 'pending' | 'rejected' | 'all'
export type AuditMethod = 'bank' | 'jazzcash' | 'all'

export interface AuditFilters {
  users: string[]
  plan: string            // '' = any
  status: AuditStatus
  method: AuditMethod
  from: string            // YYYY-MM-DD (PKT), '' = no bound
  to: string
  q: string
}

export type AuditFlag = 'duplicate-tid' | 'duplicate-screenshot' | 'amount-mismatch' | 'no-proof'

export interface AuditRow {
  id: string
  paidAt: string          // ISO
  userId: string
  name: string
  email: string
  plan: string
  planLabel: string
  method: 'bank' | 'jazzcash'
  amountPkr: number
  planPricePkr: number | null
  reference: string
  status: 'pending' | 'approved' | 'rejected'
  reviewedAt: string | null
  reviewedBy: string | null
  grantedUntil: string | null
  adminNote: string | null
  hasProof: boolean
  proofType: string | null
  flags: AuditFlag[]
}

export interface AuditSummary {
  payments: number
  totalPkr: number
  bankPkr: number
  jazzcashPkr: number
  flagged: number
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
/** Start of a Pakistan day (UTC+5, no DST) as a UTC Date. */
const pktStart = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 5 * 3600_000)

export function parseFilters(sp: URLSearchParams): AuditFilters {
  const status = sp.get('status') as AuditStatus
  const method = sp.get('method') as AuditMethod
  const plan = sp.get('plan') ?? ''
  return {
    users: (sp.get('users') ?? '').split(',').map(s => s.trim()).filter(s => s && s.length <= 64).slice(0, 200),
    plan: LOCAL_PLANS.some(p => p.slug === plan) ? plan : '',
    status: ['approved', 'pending', 'rejected', 'all'].includes(status) ? status : 'approved',
    method: ['bank', 'jazzcash', 'all'].includes(method) ? method : 'all',
    from: DAY.test(sp.get('from') ?? '') ? sp.get('from')! : '',
    to: DAY.test(sp.get('to') ?? '') ? sp.get('to')! : '',
    q: (sp.get('q') ?? '').trim().slice(0, 100),
  }
}

function mongoFilter(f: AuditFilters): Record<string, unknown> {
  const and: Record<string, unknown>[] = []
  if (f.users.length) and.push({ userId: { $in: f.users } })
  if (f.plan) and.push({ plan: f.plan })
  if (f.status !== 'all') and.push({ status: f.status })
  if (f.method !== 'all') and.push({ method: f.method })
  if (f.from || f.to) {
    const range: Record<string, Date> = {}
    if (f.from) range.$gte = pktStart(f.from)
    if (f.to) range.$lt = new Date(pktStart(f.to).getTime() + 86_400_000)
    and.push({ createdAt: range })
  }
  if (f.q) {
    const rx = new RegExp(f.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    and.push({ $or: [{ userEmail: rx }, { userName: rx }, { reference: rx }] })
  }
  return and.length ? { $and: and } : {}
}

const normTid = (s: string | null | undefined) => (s ?? '').replace(/[\s-]/g, '').toUpperCase()

/**
 * Transaction IDs and screenshot fingerprints used by more than one payment,
 * across ALL local payments (a fake often reuses a real one). Hashing every proof
 * reads all screenshots once, so the result is kept for 10 minutes.
 */
async function duplicateIndex(): Promise<{ tids: Set<string>; proofs: Map<string, string> }> {
  const key = 'local-audit:dupes'
  const hit = memCache.get<{ tids: string[]; proofs: [string, string][] }>(key)
  if (hit) return { tids: new Set(hit.tids), proofs: new Map(hit.proofs) }

  const tidCount = new Map<string, number>()
  const proofOf = new Map<string, string>()      // payment id -> sha1
  const proofCount = new Map<string, number>()
  const cursor = LocalPayment.find({}).select('+proof reference').lean().cursor()
  for await (const p of cursor as AsyncIterable<{ _id: unknown; reference?: string | null; proof?: { data?: string } | null }>) {
    const t = normTid(p.reference)
    if (t.length >= 4) tidCount.set(t, (tidCount.get(t) ?? 0) + 1)
    if (p.proof?.data) {
      const h = createHash('sha1').update(p.proof.data).digest('hex')
      proofOf.set(String(p._id), h)
      proofCount.set(h, (proofCount.get(h) ?? 0) + 1)
    }
  }
  const tids = [...tidCount].filter(([, n]) => n > 1).map(([t]) => t)
  const proofs = [...proofOf].filter(([, h]) => (proofCount.get(h) ?? 0) > 1)
  memCache.set(key, { tids, proofs }, 600)
  return { tids: new Set(tids), proofs: new Map(proofs) }
}

interface RawPayment {
  _id: unknown
  createdAt: Date
  userId: string
  userName?: string
  userEmail: string
  plan: string
  method: 'bank' | 'jazzcash'
  amountPkr: number
  reference?: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewedAt?: Date | null
  reviewedBy?: string | null
  grantedUntil?: Date | null
  adminNote?: string | null
  hasProof?: boolean
  proof?: { contentType?: string } | null
}

const PROJECTION = {
  createdAt: 1, userId: 1, userName: 1, userEmail: 1, plan: 1, method: 1, amountPkr: 1, reference: 1, status: 1,
  reviewedAt: 1, reviewedBy: 1, grantedUntil: 1, adminNote: 1, hasProof: 1, 'proof.contentType': 1,
}

function toRow(p: RawPayment, dup: { tids: Set<string>; proofs: Map<string, string> }): AuditRow {
  const lp = localPlanFor(p.plan)
  const flags: AuditFlag[] = []
  if (dup.tids.has(normTid(p.reference))) flags.push('duplicate-tid')
  if (dup.proofs.has(String(p._id))) flags.push('duplicate-screenshot')
  if (lp && p.amountPkr !== lp.pkr) flags.push('amount-mismatch')
  if (!p.hasProof) flags.push('no-proof')
  return {
    id: String(p._id),
    paidAt: new Date(p.createdAt).toISOString(),
    userId: p.userId,
    name: p.userName ?? '',
    email: p.userEmail,
    plan: p.plan,
    planLabel: lp?.label ?? p.plan,
    method: p.method,
    amountPkr: p.amountPkr,
    planPricePkr: lp?.pkr ?? null,
    reference: p.reference ?? '',
    status: p.status,
    reviewedAt: p.reviewedAt ? new Date(p.reviewedAt).toISOString() : null,
    reviewedBy: p.reviewedBy ?? null,
    grantedUntil: p.grantedUntil ? new Date(p.grantedUntil).toISOString() : null,
    adminNote: p.adminNote ?? null,
    hasProof: !!p.hasProof,
    proofType: p.proof?.contentType ?? null,
    flags,
  }
}

export async function auditRows(f: AuditFilters, opts: { page?: number; limit?: number; flaggedOnly?: boolean; max?: number } = {}) {
  await connectDB()
  const filter = mongoFilter(f)
  const [dup, raw, sums] = await Promise.all([
    duplicateIndex(),
    LocalPayment.find(filter).select(PROJECTION).sort({ createdAt: -1 }).limit(opts.max ?? 5000).lean<RawPayment[]>(),
    LocalPayment.aggregate<{ _id: string; n: number; pkr: number }>([
      { $match: filter },
      { $group: { _id: '$method', n: { $sum: 1 }, pkr: { $sum: '$amountPkr' } } },
    ]),
  ])
  let rows = raw.map(p => toRow(p, dup))
  const flagged = rows.filter(r => r.flags.some(fl => fl !== 'no-proof')).length
  if (opts.flaggedOnly) rows = rows.filter(r => r.flags.some(fl => fl !== 'no-proof'))
  const by = (m: string) => sums.find(s => s._id === m)
  const summary: AuditSummary = {
    payments: sums.reduce((a, s) => a + s.n, 0),
    totalPkr: sums.reduce((a, s) => a + s.pkr, 0),
    bankPkr: by('bank')?.pkr ?? 0,
    jazzcashPkr: by('jazzcash')?.pkr ?? 0,
    flagged,
  }
  if (!opts.limit) return { rows, total: rows.length, summary }
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / opts.limit))
  const page = Math.min(pages, Math.max(1, opts.page ?? 1))
  return { rows: rows.slice((page - 1) * opts.limit, page * opts.limit), total, pages, page, summary }
}

/** Customers who have paid locally, for the picker. */
export async function auditPayers(q: string) {
  await connectDB()
  const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null
  return LocalPayment.aggregate<{ _id: string; name: string; email: string; payments: number }>([
    { $match: rx ? { $or: [{ userEmail: rx }, { userName: rx }, { reference: rx }] } : {} },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$userId', name: { $first: '$userName' }, email: { $first: '$userEmail' }, payments: { $sum: 1 } } },
    { $sort: { payments: -1, email: 1 } },
    { $limit: 20 },
  ])
}

// ─── Exports ──────────────────────────────────────────────────────────────────

const pktDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const pktTime = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
export const FLAG_LABEL: Record<AuditFlag, string> = {
  'duplicate-tid': 'Transaction ID used more than once',
  'duplicate-screenshot': 'Same screenshot used more than once',
  'amount-mismatch': 'Amount differs from plan price',
  'no-proof': 'No screenshot',
}

export function auditCsv(rows: AuditRow[], origin: string): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = ['Payment ID', 'Date (PKT)', 'Time (PKT)', 'Customer', 'Email', 'Plan', 'Method', 'Amount (PKR)', 'Plan price (PKR)',
    'Transaction ID', 'Status', 'Reviewed on (PKT)', 'Reviewed by', 'Plan granted until', 'Admin note', 'Warnings', 'Screenshot link']
  const lines = rows.map(r => [
    r.id, pktDate(r.paidAt), pktTime(r.paidAt), r.name, r.email, r.planLabel, r.method === 'bank' ? 'Bank transfer' : 'JazzCash',
    r.amountPkr, r.planPricePkr ?? '', r.reference, r.status, r.reviewedAt ? pktDate(r.reviewedAt) : '', r.reviewedBy ?? '',
    r.grantedUntil ? pktDate(r.grantedUntil) : '', r.adminNote ?? '', r.flags.map(f => FLAG_LABEL[f]).join('; '),
    r.hasProof ? `${origin}/api/admin/local-payments/${r.id}/proof` : '',
  ].map(esc).join(','))
  // BOM so Excel opens Urdu names and the Rs amounts correctly.
  return '﻿' + [head.join(','), ...lines].join('\r\n')
}

/** Standard PDF fonts only cover Latin-1; anything else prints as "?". */
const safe = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')

/** A name in another script (e.g. Urdu) cannot be printed with the standard fonts. */
const pdfName = (name: string) => (!name ? '(no name)' : /[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D]/.test(name) ? '(name in Urdu, see CSV)' : name)

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let t = safe(text)
  if (font.widthOfTextAtSize(t, size) <= width) return t
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1)
  return `${t}...`
}

type Sharp = (input: Buffer) => { rotate: () => { resize: (o: object) => { jpeg: (o: object) => { toBuffer: () => Promise<Buffer> } } } }
let sharpLoad: Promise<Sharp | null> | null = null
/** sharp ships with Next.js; if it is ever missing, JPG/PNG proofs embed unshrunk. */
const loadSharp = () => (sharpLoad ??= import('sharp').then(m => (m.default ?? m) as unknown as Sharp).catch(() => null))

export const PDF_MAX = 300

export async function auditPdf(f: AuditFilters, rows: AuditRow[], summary: AuditSummary): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Rankkw local payments')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.13, 0.13, 0.12), grey = rgb(0.42, 0.42, 0.39), red = rgb(0.72, 0.11, 0.11), line = rgb(0.86, 0.85, 0.82)
  const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`

  // ── Summary + table pages (landscape A4) ──
  const W = 842, H = 595, M = 32
  const cols: [string, number][] = [['Date (PKT)', 92], ['Customer', 190], ['Plan', 80], ['Method', 62], ['Amount', 70], ['Transaction ID', 130], ['Status', 62], ['Warnings', 92]]
  let page: PDFPage = pdf.addPage([W, H])
  let y = H - M
  const text = (p: PDFPage, s: string, x: number, yy: number, size = 9, f2 = font, color = ink) => p.drawText(safe(s), { x, y: yy, size, font: f2, color })

  text(page, 'Rankkw local payments (bank / JazzCash)', M, y, 16, bold); y -= 20
  const fl = [
    f.from || f.to ? `Dates ${f.from || 'start'} to ${f.to || 'today'} (PKT)` : 'All dates',
    f.status === 'all' ? 'Any status' : `Status: ${f.status}`,
    f.method === 'all' ? 'Bank + JazzCash' : f.method === 'bank' ? 'Bank only' : 'JazzCash only',
    f.plan ? `Plan: ${localPlanFor(f.plan)?.label ?? f.plan}` : 'All plans',
    f.users.length ? `${f.users.length} selected customer${f.users.length === 1 ? '' : 's'}` : 'All customers',
  ].join('  |  ')
  text(page, fl, M, y, 9, font, grey); y -= 14
  text(page, `Generated ${pktDate(new Date().toISOString())} ${pktTime(new Date().toISOString())} PKT`, M, y, 9, font, grey); y -= 22
  text(page, `${summary.payments} payments   Total ${rs(summary.totalPkr)}   Bank ${rs(summary.bankPkr)}   JazzCash ${rs(summary.jazzcashPkr)}   With warnings: ${summary.flagged}`, M, y, 11, bold); y -= 24

  const header = () => {
    let x = M
    for (const [h, w] of cols) { text(page, h, x, y, 8.5, bold, grey); x += w }
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: line }); y -= 12
  }
  header()
  for (const r of rows) {
    if (y < M + 14) { page = pdf.addPage([W, H]); y = H - M; header() }
    const warn = r.flags.filter(x => x !== 'no-proof').length ? r.flags.filter(x => x !== 'no-proof').map(x => x === 'duplicate-tid' ? 'Dup TID' : x === 'duplicate-screenshot' ? 'Dup image' : 'Amount').join(', ') : (r.hasProof ? '' : 'No image')
    const cells = [`${pktDate(r.paidAt)} ${pktTime(r.paidAt)}`, `${pdfName(r.name)} <${r.email}>`, r.planLabel, r.method === 'bank' ? 'Bank' : 'JazzCash',
      rs(r.amountPkr), r.reference || '-', r.status, warn]
    let x = M
    cells.forEach((c, i) => { text(page, fit(c, font, 8.5, cols[i][1] - 6), x, y, 8.5, font, i === 7 && warn ? red : ink); x += cols[i][1] })
    y -= 14
  }

  // ── One page per payment, with its screenshot (portrait A4) ──
  const sharp = await loadSharp()
  const PW = 595, PH = 842
  const proofs = await LocalPayment.find({ _id: { $in: rows.filter(r => r.hasProof).map(r => r.id).filter(isValidObjectId) } })
    .select('+proof').lean<{ _id: unknown; proof?: { contentType?: string; data?: string } | null }[]>()
  const proofOf = new Map(proofs.map(p => [String(p._id), p.proof]))

  for (const r of rows) {
    const p = pdf.addPage([PW, PH])
    let yy = PH - M
    text(p, fit(`${pdfName(r.name)}  <${r.email}>`, bold, 13, PW - M * 2), M, yy, 13, bold); yy -= 18
    const details: [string, string][] = [
      ['Paid (PKT)', `${pktDate(r.paidAt)} ${pktTime(r.paidAt)}`], ['Amount', `${rs(r.amountPkr)}${r.planPricePkr != null ? `  (plan price ${rs(r.planPricePkr)})` : ''}`],
      ['Method', r.method === 'bank' ? 'Bank transfer' : 'JazzCash'], ['Transaction ID', r.reference || '-'], ['Plan', r.planLabel],
      ['Status', `${r.status}${r.reviewedAt ? `, reviewed ${pktDate(r.reviewedAt)}${r.reviewedBy ? ` by ${r.reviewedBy}` : ''}` : ''}`],
      ['Payment ID', r.id],
    ]
    for (const [k, v] of details) { text(p, k, M, yy, 9.5, font, grey); text(p, fit(v, font, 9.5, PW - M * 2 - 100), M + 100, yy, 9.5); yy -= 14 }
    const warns = r.flags.filter(x => x !== 'no-proof')
    if (warns.length) { yy -= 2; text(p, `Warning: ${warns.map(x => FLAG_LABEL[x]).join('; ')}`, M, yy, 10, bold, red); yy -= 14 }
    yy -= 8
    const box = { x: M, y: M, w: PW - M * 2, h: yy - M }
    const proof = proofOf.get(r.id)
    try {
      if (!proof?.data) { text(p, 'No screenshot attached.', M, yy - 12, 10, font, grey); continue }
      const buf = Buffer.from(proof.data, 'base64')
      if (proof.contentType === 'application/pdf') {
        const [emb] = await pdf.embedPdf(buf, [0])
        const s = Math.min(box.w / emb.width, box.h / emb.height, 1)
        p.drawPage(emb, { x: box.x, y: box.y + box.h - emb.height * s, width: emb.width * s, height: emb.height * s })
        continue
      }
      let img
      if (sharp) img = await pdf.embedJpg(await sharp(buf).rotate().resize({ width: 1100, height: 1500, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer())
      else if (proof.contentType === 'image/png') img = await pdf.embedPng(buf)
      else if (proof.contentType === 'image/jpeg' || proof.contentType === 'image/jpg') img = await pdf.embedJpg(buf)
      if (!img) { text(p, `Screenshot is ${proof.contentType}; open it from the admin panel.`, M, yy - 12, 10, font, grey); continue }
      const s = Math.min(box.w / img.width, box.h / img.height, 1)
      p.drawImage(img, { x: box.x, y: box.y + box.h - img.height * s, width: img.width * s, height: img.height * s })
    } catch {
      text(p, 'The screenshot could not be read; open it from the admin panel.', M, yy - 12, 10, font, red)
    }
  }
  return pdf.save()
}
