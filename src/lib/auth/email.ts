import nodemailer from 'nodemailer'
import { siteUrl } from '@/lib/seo/site'

/**
 * Email delivery. Preferred path is Resend (set RESEND_API_KEY) sending from
 * support@rankkw.com — this is what powers the password-reset OTP and welcome
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
const SMTP_FROM   = process.env.EMAIL_FROM || `"Rankkw" <${process.env.SMTP_USER ?? 'noreply@rankkw.com'}>`
// Absolute URLs — email clients can't resolve relative paths, and siteUrl()
// returns the real production origin (never localhost) in prod.
const APP_URL  = siteUrl()
const LOGO_URL = `${APP_URL}/website_logo.png`

/** Send one email — via Resend's REST API when configured, else SMTP. */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
    })
    if (!res.ok) {
      throw new Error(`Resend send failed (${res.status}): ${await res.text().catch(() => '')}`)
    }
    return
  }
  await transporter.sendMail({ from: SMTP_FROM, to, subject, html })
}

export async function sendOtpEmail(email: string, otp: string, type: 'reset' | 'verify') {
  const subject = type === 'reset' ? 'Reset your Rankkw password' : 'Verify your Rankkw account'
  const action  = type === 'reset' ? 'reset your password' : 'verify your account'

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
            We received a request to ${action}. Use the 6-digit code below. It expires in <strong>10 minutes</strong>.
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

export async function sendWelcomeEmail(email: string, name: string) {
  await sendEmail(email, `Welcome to Rankkw, ${name}! 🌱`, `
<!DOCTYPE html><html><body style="font-family:'Inter',-apple-system,sans-serif;background:#EEEBE1;padding:40px 20px;margin:0">
<table width="480" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#F6F4EC;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">
  <tr><td style="background:#FFFFFF;padding:26px 40px;text-align:center;border-bottom:1px solid rgba(0,0,0,0.06)">
    <img src="${LOGO_URL}" alt="Rankkw" width="150" style="display:inline-block;height:auto;max-width:160px;border:0;outline:none;text-decoration:none" />
  </td></tr>
  <tr><td style="padding:40px">
    <h1 style="font-size:22px;font-weight:400;color:#3D3E3B;margin:0 0 12px">Welcome, ${name}!</h1>
    <p style="font-size:14px;color:#666;line-height:1.65;margin:0 0 24px">
      Your account is ready. Start researching Etsy keywords and growing your shop today.
    </p>
    <a href="${APP_URL}/dashboard" style="display:inline-block;background:#FB5E09;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:14px;font-weight:500">
      Open Dashboard →
    </a>
  </td></tr>
</table>
</body></html>`)
}
