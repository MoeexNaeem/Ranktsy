import { NextRequest, NextResponse } from 'next/server'

// Visitor country → display currency. Pakistan sees PKR; everyone else USD.
// Cloudflare adds `cf-ipcountry` on every request; absent (e.g. local dev) → USD.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(req: NextRequest) {
  const country = (req.headers.get('cf-ipcountry') || '').toUpperCase()
  const currency = country === 'PK' ? 'PKR' : 'USD'
  return NextResponse.json({ country, currency }, { headers: { 'Cache-Control': 'no-store' } })
}
