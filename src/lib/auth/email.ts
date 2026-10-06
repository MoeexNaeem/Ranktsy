import nodemailer from 'nodemailer'
import mongoose from 'mongoose'
import { siteUrl } from '@/lib/seo/site'
import { connectDB } from '@/lib/db'

/**
 * Email delivery. Preferred path is Resend (set RESEND_API_KEY) sending from
 * support@rankkw.com - this is what powers the password-reset OTP and welcome
 * emails in production. If no Resend key is set, we fall back to SMTP
 * (nodemailer) so local/dev setups still work.
 *
 * ⚠️ Resend requires the sending domain (rankkw.com) to be verified in the
 * Resend dashboard (SPF + DKIM DNS records). Until it is, sends are rejected.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// From address. Resend sends from support@rankkw.com by default; the SMTP
// fallback uses the authenticated mailbox (some providers reject a mismatched
// From). Override either with EMAIL_FROM.
const RESEND_FROM = process.env.EMAIL_FROM || 'Rankkw Support <support@rankkw.com>'
// Gmail only sends as the signed-in mailbox, so the SMTP backup never borrows
// EMAIL_FROM (support@rankkw.com): it sends as "Rankkw" <SMTP_USER>, or SMTP_FROM.
const SMTP_FROM   = process.env.SMTP_FROM || `"Rankkw" <${process.env.SMTP_USER ?? 'noreply@rankkw.com'}>`
// Absolute URLs - email clients can't resolve relative paths, and siteUrl()
// returns the real production origin (never localhost) in prod.
const APP_URL  = siteUrl()
const LOGO_URL = `${APP_URL}/website_logo.png`

const SMTP_READY = !!(process.env.SMTP_USER && process.env.SMTP_PASS)

// Resend's free plan: 100 emails a day and 3,000 a month. Past either limit Resend
// still ANSWERS "accepted" and only fails the email afterwards, so a failed request
// never told us to switch (2026-10-06: 56 signup codes silently lost after 18:19 UTC).
// We count our own Resend sends instead (shared by all workers, in Mongo) and move
// to the SMTP backup a little before the limit.
const RESEND_DAILY_LIMIT = Number(process.env.RESEND_DAILY_LIMIT) || 95
const RESEND_MONTHLY_LIMIT = Number(process.env.RESEND_MONTHLY_LIMIT) || 2950

/**
 * Safety net: Resend can accept an email and fail it moments later (quota reached,
 * provider trouble). Shortly after each send, ask Resend how it went; if it failed,
 * send the same email through the SMTP backup so the person still gets it.
 * "bounced" (the address itself rejected it) is not retried.
 */
function watchResendDelivery(id: string, to: string, subject: string, html: string) {
  setTimeout(async () => {
    try {
      const r = await fetch(`https://api.resend.com/emails/${id}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        signal: AbortSignal.timeout(10_000),
      })
      const ev = ((await r.json().catch(() => null)) as { last_event?: string } | null)?.last_event
      if (ev !== 'failed') return
      await transporter.sendMail({ from: SMTP_FROM, to, subject, html })
      console.warn(`[email] Resend failed email ${id}; re-sent through SMTP`)
    } catch (e) {
      console.error('[email] delivery check failed:', e instanceof Error ? e.message : e)
    }
  }, 45_000)
}

/** Reserve one Resend send; false when today's or this month's allowance is used up. */
async function claimResendSend(): Promise<boolean> {
  try {
    await connectDB()
    const col = mongoose.connection.db!.collection<{ _id: string; n: number }>('emailsends')
    const now = new Date().toISOString()
    const [day, month] = await Promise.all([
      col.findOneAndUpdate({ _id: `resend|${now.slice(0, 10)}` }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' }),
      col.findOneAndUpdate({ _id: `resend|${now.slice(0, 7)}` }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' }),
    ])
    return (day?.n ?? 0) <= RESEND_DAILY_LIMIT && (month?.n ?? 0) <= RESEND_MONTHLY_LIMIT
  } catch {
    return true   // counter unavailable: keep using Resend rather than block email
  }
}

/**
 * Send one email. Resend first (free plan: 100 a day); if Resend refuses (daily
 * limit reached, or any other error) and an SMTP mailbox is configured, the same
 * email goes out through SMTP instead. With a Gmail app password that is another
 * ~500 free emails a day, so signup codes keep arriving on busy days.
 */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  // Resend while its free allowance lasts (or always, when there is no SMTP backup).
  if (RESEND_API_KEY && (!SMTP_READY || await claimResendSend())) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
        signal: AbortSignal.timeout(15_000),
      })
      if (res.ok) {
        const id = ((await res.json().catch(() => null)) as { id?: string } | null)?.id
        if (id && SMTP_READY) watchResendDelivery(id, to, subject, html)
        return
      }
      const why = `Resend send failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`
      if (!SMTP_READY) throw new Error(why)
      console.warn(`[email] ${why} - sending through SMTP instead`)
    } catch (e) {
      if (!SMTP_READY) throw e
      console.warn('[email] Resend unavailable, sending through SMTP instead:', e instanceof Error ? e.message : e)
    }
  }
  await transporter.sendMail({ from: SMTP_FROM, to, subject, html })
}

/**
 * Admin check of ONE delivery path (Resend, or the SMTP backup) with no fallback,
 * so each can be confirmed on the live server. Returns the sender used.
 */
export async function sendDeliveryTest(to: string, via: 'resend' | 'smtp'): Promise<{ from: string; detail: string }> {
  const subject = `Rankkw email test (${via === 'resend' ? 'Resend' : 'Gmail backup'})`
  const html = `<p style="font-family:sans-serif;font-size:14px;color:#333">This is a delivery test sent through <strong>${via === 'resend' ? 'Resend' : 'the SMTP backup'}</strong>. If you can read it, this path works.</p>`
  if (via === 'resend') {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set on this server')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
      signal: AbortSignal.timeout(15_000),
    })
    const text = (await res.text().catch(() => '')).slice(0, 300)
    if (!res.ok) throw new Error(`Resend refused (${res.status}): ${text}`)
    return { from: RESEND_FROM, detail: text }
  }
  if (!SMTP_READY) throw new Error('SMTP_USER / SMTP_PASS are not set on this server')
  const info = await transporter.sendMail({ from: SMTP_FROM, to, subject, html })
  return { from: SMTP_FROM, detail: String(info.response ?? '') }
}

/**
 * Send an admin-composed message to one user, wrapped in the Rankkw template.
 * `message` is plain text (blank lines start new paragraphs); it is HTML-escaped so
 * an admin cannot inject markup. Throws if delivery fails so the caller can report it.
 */
export async function sendUserEmail(to: string, subject: string, message: string, opts?: { heading?: string }) {
  const heading = (opts?.heading || subject).trim()
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const bodyHtml = esc(message)
    .split(/\n{2,}/)
    .map(p => `<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 16px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  await sendEmail(to, subject, `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEEBE1;font-family:'Inter',-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#F6F4EC;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">
        <tr><td style="background:#FFFFFF;padding:26px 40px;text-align:center;border-bottom:1px solid rgba(0,0,0,0.06)">
          <img src="${LOGO_URL}" alt="Rankkw" width="150" style="display:inline-block;height:auto;max-width:160px;border:0;outline:none;text-decoration:none" />
        </td></tr>
        <tr><td style="padding:40px">
          <h1 style="font-size:22px;font-weight:400;color:#3D3E3B;margin:0 0 20px;letter-spacing:-0.5px">${esc(heading)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(0,0,0,0.06);text-align:center">
          <p style="font-size:11px;color:#bbb;margin:0;font-family:monospace">
            © 2026 Rankkw. Not affiliated with Etsy, Inc.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`)
}

export async function sendOtpEmail(email: string, otp: string, type: 'reset' | 'verify', minutes = 10) {
  const subject = type === 'reset' ? 'Reset your Rankkw password' : 'Your Rankkw verification code'
  const action  = type === 'reset' ? 'reset your password' : 'confirm this email address for your new Rankkw account'

  await sendEmail(email, subject, `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEEBE1;font-family:'Inter',-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#F6F4EC;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#FFFFFF;padding:26px 40px;text-align:center;border-bottom:1px solid rgba(0,0,0,0.06)">
          <img src="${LOGO_URL}" alt="Rankkw" width="150" style="display:inline-block;height:auto;max-width:160px;border:0;outline:none;text-decoration:none" />
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px">
          <h1 style="font-size:22px;font-weight:400;color:#3D3E3B;margin:0 0 12px;letter-spacing:-0.5px">${subject}</h1>
          <p style="font-size:14px;color:#666;line-height:1.65;margin:0 0 32px">
            We received a request to ${action}. Use the 6-digit code below. It expires in <strong>${minutes} minutes</strong>.
          </p>
          <!-- OTP Box -->
          <div style="background:#EEEBE1;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px">
            <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#FB5E09;font-family:'General Sans',monospace">${otp}</div>
          </div>
          <p style="font-size:13px;color:#aaa;margin:0">
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(0,0,0,0.06);text-align:center">
          <p style="font-size:11px;color:#bbb;margin:0;font-family:monospace">
            © 2026 Rankkw. Not affiliated with Etsy, Inc.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`)
}
