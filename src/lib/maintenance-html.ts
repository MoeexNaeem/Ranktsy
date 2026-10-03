/**
 * The "We are updating Rankkw" page as a plain HTML string, served by the proxy
 * during maintenance. Rendering the React /maintenance page for every visitor,
 * crawler and reconnecting tab cost real CPU while the site was meant to be
 * resting; a fixed string costs almost nothing. Same look and the admin's message.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function maintenanceHtml(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>We are updating Rankkw</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FBF9F4;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:32px 16px;box-sizing:border-box}
.c{width:100%;max-width:560px;background:#fff;border:1px solid #e7e4da;border-radius:24px;padding:40px 32px;box-shadow:0 24px 60px rgba(40,35,20,.08);text-align:center;box-sizing:border-box}
img{width:136px;height:44px;object-fit:contain;display:block;margin:0 auto 26px}
.i{width:64px;height:64px;border-radius:18px;margin:0 auto 20px;background:rgba(251,94,9,.1);display:flex;align-items:center;justify-content:center}
h1{font-size:28px;font-weight:600;color:#2A2A28;letter-spacing:-.02em;margin:0 0 12px}
p{font-size:15px;color:#5F5F57;line-height:1.65;margin:0 auto 24px;max-width:440px}
.b{display:inline-flex;align-items:center;gap:9px;background:#F6F4EE;border:1px solid #e7e4da;border-radius:999px;padding:8px 16px;font-size:13px;color:#5F5F57}
.d{width:8px;height:8px;border-radius:50%;background:#FB5E09;box-shadow:0 0 0 4px rgba(251,94,9,.15)}
small{display:block;font-size:13px;color:#8a8a82;margin-top:22px;line-height:1.6}</style></head>
<body><main class="c"><img src="/website_logo.png" alt="Rankkw"><div class="i"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FB5E09" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
<h1>We are updating Rankkw</h1><p>${esc(message)}</p><div class="b"><span class="d"></span>Your account, credits and saved work are safe.</div>
<small>Please check back in a little while. Questions? Contact us at 0327 9100000.</small></main></body></html>`
}
