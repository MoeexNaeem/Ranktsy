import { NextRequest } from 'next/server'
import { adsRoute, parseBody } from '@/lib/google-ads-route'
import { listCallouts, createCallouts, createCalloutsSchema } from '@/lib/google-ads-assets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: account-level callouts.
export async function GET() {
  return adsRoute(({ token, account }) => listCallouts(token, account))
}

// POST { texts: string[] }: add account-level callouts.
export async function POST(req: NextRequest) {
  return adsRoute(async ({ token, account }) => createCallouts(token, account, await parseBody(req, createCalloutsSchema)), { mutates: true })
}
