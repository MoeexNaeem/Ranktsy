import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = `"Ranksty" <${process.env.SMTP_USER ?? 'noreply@seedrank.app'}>`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function sendOtpEmail(email: string, otp: string, type: 'reset' | 'verify') {
  const subject = type === 'reset' ? 'Reset your Ranksty password' : 'Verify your Ranksty account'
  const action  = type === 'reset' ? 'reset your password' : 'verify your account'

  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0EFED;font-family:'Inter',-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#F8F7F5;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#3C3C3C;padding:28px 40px;text-align:center">
          <div style="font-size:22px;font-weight:600;color:#F8F7F5;letter-spacing:-0.5px">🌱 Ranksty</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px">
          <h1 style="font-size:22px;font-weight:400;color:#3C3C3C;margin:0 0 12px;letter-spacing:-0.5px">${subject}</h1>
          <p style="font-size:14px;color:#666;line-height:1.65;margin:0 0 32px">
            We received a request to ${action}. Use the 6-digit code below. It expires in <strong>10 minutes</strong>.
          </p>
          <!-- OTP Box -->
          <div style="background:#F0EFED;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px">
            <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#3C3C3C;font-family:'IBM Plex Mono',monospace">${otp}</div>
          </div>
          <p style="font-size:13px;color:#aaa;margin:0">
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(0,0,0,0.06);text-align:center">
          <p style="font-size:11px;color:#bbb;margin:0;font-family:monospace">
            © 2026 Ranksty. Not affiliated with Etsy, Inc.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

export async function sendWelcomeEmail(email: string, name: string) {
  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject: `Welcome to Ranksty, ${name}! 🌱`,
    html: `
<!DOCTYPE html><html><body style="font-family:'Inter',-apple-system,sans-serif;background:#F0EFED;padding:40px 20px;margin:0">
<table width="480" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#F8F7F5;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">
  <tr><td style="background:#3C3C3C;padding:28px 40px;text-align:center">
    <div style="font-size:22px;font-weight:600;color:#F8F7F5">🌱 Ranksty</div>
  </td></tr>
  <tr><td style="padding:40px">
    <h1 style="font-size:22px;font-weight:400;color:#3C3C3C;margin:0 0 12px">Welcome, ${name}!</h1>
    <p style="font-size:14px;color:#666;line-height:1.65;margin:0 0 24px">
      Your account is ready. Start researching Etsy keywords and growing your shop today.
    </p>
    <a href="${APP_URL}/dashboard" style="display:inline-block;background:#3C3C3C;color:#F8F7F5;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:14px;font-weight:500">
      Open Dashboard →
    </a>
  </td></tr>
</table>
</body></html>`,
  })
}
