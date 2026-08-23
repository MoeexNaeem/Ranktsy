import { NextRequest, NextResponse } from 'next/server'
import { getListingById } from '@/lib/etsy'
import { memCache, cacheKey } from '@/lib/cache'
import { rateLimit, clientIp } from '@/lib/auth/rateLimit'

/**
 * Model Context Protocol (MCP) server — Streamable HTTP transport, JSON-RPC 2.0.
 *
 * A single public endpoint that lets AI agents (Claude, ChatGPT, …) call Rankkw
 * natively. It advertises `tools` and `resources` in the initialize handshake.
 *
 * Deliberately exposes only SAFE, low-cost capabilities: a pure-math Etsy fee
 * calculator, a cached currency converter, and a single public Etsy listing
 * lookup (one cached, rate-limited Etsy call — public data, not the paid keyword
 * pipeline). Deeper keyword/competitor research stays behind an account in the app.
 *
 * This route is in the middleware PUBLIC_API allowlist (agents connect without a
 * session) and sends permissive CORS scoped to THIS endpoint only.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROTOCOL_VERSION = '2025-06-18'
const SERVER = { name: 'Rankkw', title: 'Rankkw — Etsy SEO', version: '1.0.0' }

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, mcp-session-id, mcp-protocol-version, authorization',
  'Access-Control-Max-Age': '86400',
}

// ─── Tools ────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'etsy_fee_calculator',
    description: 'Calculate Etsy selling fees and net profit for a sale. Returns listing, transaction (6.5%), and payment-processing fees, total fees, and net. Rates are approximate US defaults. Pure calculation, no account needed.',
    inputSchema: {
      type: 'object',
      properties: {
        price: { type: 'number', description: 'Item price per unit, in the listing currency.' },
        quantity: { type: 'integer', description: 'Units sold.', default: 1 },
        shipping: { type: 'number', description: 'Shipping income charged to the buyer.', default: 0 },
        itemCost: { type: 'number', description: 'Your cost per item (optional, for margin).', default: 0 },
      },
      required: ['price'],
    },
  },
  {
    name: 'convert_to_usd',
    description: 'Convert an amount from any ISO-4217 currency to USD using a live, cached exchange rate. Useful for normalizing Etsy prices across markets.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount to convert.' },
        currency: { type: 'string', description: '3-letter currency code, e.g. PKR, GBP, EUR.' },
      },
      required: ['amount', 'currency'],
    },
  },
  {
    name: 'etsy_listing_lookup',
    description: 'Look up a single PUBLIC Etsy listing by its URL or numeric ID and return its real title, price, tags, views and favorites. One cached, rate-limited call to the official Etsy API.',
    inputSchema: {
      type: 'object',
      properties: {
        listing: { type: 'string', description: 'An Etsy listing URL (etsy.com/listing/123456789/...) or the numeric listing ID.' },
      },
      required: ['listing'],
    },
  },
]

async function fxToUsd(currency: string): Promise<number | null> {
  const from = currency.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
  if (!from || from.length !== 3) return null
  if (from === 'USD') return 1
  const key = cacheKey('fx', 'v1', from)
  const hit = memCache.get<number | null>(key)
  if (hit !== null) return hit
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, { cache: 'no-store' })
    const j = await res.json() as { result?: string; rates?: Record<string, number> }
    const rate = j.result === 'success' && typeof j.rates?.USD === 'number' ? j.rates.USD : null
    memCache.set(key, rate, rate != null ? 60 * 60 * 12 : 60 * 5)
    return rate
  } catch { return null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTool(name: string, args: any, req: NextRequest): Promise<{ text: string; isError?: boolean }> {
  const ip = clientIp(req)
  if (name === 'etsy_fee_calculator') {
    const price = Number(args?.price)
    if (!Number.isFinite(price) || price < 0) return { text: 'Provide a valid "price".', isError: true }
    const quantity = Math.max(1, Math.floor(Number(args?.quantity) || 1))
    const shipping = Math.max(0, Number(args?.shipping) || 0)
    const itemCost = Math.max(0, Number(args?.itemCost) || 0)
    const revenue = price * quantity + shipping
    const listingFee = 0.20 * quantity
    const transactionFee = revenue * 0.065
    const processingFee = revenue * 0.03 + 0.25 // approx US: 3% + $0.25
    const totalFees = listingFee + transactionFee + processingFee
    const net = revenue - totalFees - itemCost * quantity
    const r = (n: number) => Math.round(n * 100) / 100
    return { text: JSON.stringify({
      revenue: r(revenue), listingFee: r(listingFee), transactionFee: r(transactionFee),
      paymentProcessingFee: r(processingFee), totalFees: r(totalFees), net: r(net),
      feePctOfRevenue: revenue ? r((totalFees / revenue) * 100) : 0,
      note: 'Approximate US rates: $0.20 listing/unit, 6.5% transaction, 3% + $0.25 processing. Etsy Ads and offsite-ad fees are not included.',
    }, null, 2) }
  }

  if (name === 'convert_to_usd') {
    const rl = rateLimit(`mcp:fx:${ip}`, 60, 60 * 60 * 1000)
    if (!rl.allowed) return { text: 'Rate limit reached. Try again shortly.', isError: true }
    const amount = Number(args?.amount)
    const currency = String(args?.currency ?? '')
    if (!Number.isFinite(amount)) return { text: 'Provide a numeric "amount".', isError: true }
    const rate = await fxToUsd(currency)
    if (rate == null) return { text: `No exchange rate available for "${currency}".`, isError: true }
    return { text: JSON.stringify({ from: currency.toUpperCase().slice(0, 3), amount, rateToUsd: rate, usd: Math.round(amount * rate * 100) / 100 }, null, 2) }
  }

  if (name === 'etsy_listing_lookup') {
    const rl = rateLimit(`mcp:listing:${ip}`, 30, 60 * 60 * 1000)
    if (!rl.allowed) return { text: 'Rate limit reached (30/hour). Try again later.', isError: true }
    const raw = String(args?.listing ?? '')
    const m = raw.match(/listing\/(\d+)/) || raw.match(/(\d{6,})/)
    const id = m ? Number(m[1]) : NaN
    if (!id) return { text: 'Provide an Etsy listing URL or numeric ID.', isError: true }
    const l = await getListingById(id).catch(() => null)
    if (!l) return { text: `No public Etsy listing found for ${id}.`, isError: true }
    const price = l.price?.divisor ? Math.round((l.price.amount / l.price.divisor) * 100) / 100 : null
    return { text: JSON.stringify({
      listingId: l.listing_id, title: l.title, price, currency: l.price?.currency_code ?? null,
      tags: l.tags ?? [], views: l.views ?? null, favorites: l.num_favorers ?? null, url: l.url,
    }, null, 2) }
  }

  return { text: `Unknown tool: ${name}`, isError: true }
}

// ─── Resources ────────────────────────────────────────────────────────────────
const ABOUT_MD = `# Rankkw

Rankkw is an Etsy SEO & analytics platform. It gives Etsy sellers real keyword research (search volume, competition, trends), competitor and tag analysis, keyword-gap detection, hot-product discovery, and AI listing tools — every figure measured from the official Etsy Open API and Google Ads, never estimated.

## When an agent should use Rankkw
Use Rankkw for tasks about an **Etsy shop or listing**: researching a keyword's demand and competition, analyzing competitor shops and tags, finding keyword gaps, discovering trending products, or generating an SEO-optimized Etsy title, tags and description. Not a fit for non-Etsy marketplaces or general web SEO.

## Available MCP tools
- \`etsy_fee_calculator\` — Etsy fees and net profit for a sale (pure math).
- \`convert_to_usd\` — live currency conversion to USD.
- \`etsy_listing_lookup\` — real public data for one Etsy listing by URL/ID.

Deeper keyword and competitor research is available in the app at https://rankkw.com (free tier, no credit card).
`

const TOOLS_MD = `# Rankkw tools

- Keyword research: https://rankkw.com/etsy-keyword-research
- Competitor analysis: https://rankkw.com/etsy-competitor-analysis
- Trend & demand analysis: https://rankkw.com/etsy-trend-analysis
- Find hot products: https://rankkw.com/etsy-find-hot-products
- Tag optimizer: https://rankkw.com/etsy-tag-optimizer
- AI title & tag generator: https://rankkw.com/etsy-ai-title-tag-generator
- Fee calculator: https://rankkw.com/etsy-fee-calculator

API spec: https://rankkw.com/openapi.json · Guide for agents: https://rankkw.com/llms.txt
`

const RESOURCES = [
  { uri: 'rankkw://about', name: 'About Rankkw', title: 'About Rankkw & when to use it', description: 'What Rankkw is and when an agent should reach for it.', mimeType: 'text/markdown', _body: ABOUT_MD },
  { uri: 'rankkw://tools', name: 'Rankkw tools', title: 'Catalog of Rankkw tools', description: 'Links to every Rankkw Etsy SEO tool, the OpenAPI spec and llms.txt.', mimeType: 'text/markdown', _body: TOOLS_MD },
]

// ─── JSON-RPC dispatch ──────────────────────────────────────────────────────────
type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }
const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0' as const, id, result })
const rpcErr = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0' as const, id, error: { code, message } })

async function handleOne(msg: Rpc, req: NextRequest): Promise<object | null> {
  const { id, method, params } = msg
  const isNotification = id === undefined || id === null

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: SERVER,
        instructions: 'Rankkw exposes Etsy-seller tools. Use etsy_fee_calculator for fee/profit math, convert_to_usd for currency, and etsy_listing_lookup for one public Etsy listing. Read the rankkw://about resource for when to use it.',
      })
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null // notification — no response
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: TOOLS })
    case 'tools/call': {
      const name = String((params as { name?: string })?.name ?? '')
      const args = (params as { arguments?: unknown })?.arguments ?? {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await runTool(name, args as any, req)
      return ok(id, { content: [{ type: 'text', text: out.text }], isError: !!out.isError })
    }
    case 'resources/list':
      return ok(id, { resources: RESOURCES.map(({ _body, ...r }) => { void _body; return r }) })
    case 'resources/templates/list':
      return ok(id, { resourceTemplates: [] })
    case 'resources/read': {
      const uri = String((params as { uri?: string })?.uri ?? '')
      const r = RESOURCES.find(x => x.uri === uri)
      if (!r) return rpcErr(id, -32602, `Unknown resource: ${uri}`)
      return ok(id, { contents: [{ uri: r.uri, mimeType: r.mimeType, text: r._body }] })
    }
    case 'prompts/list':
      return ok(id, { prompts: [] })
    default:
      return isNotification ? null : rpcErr(id, -32601, `Method not found: ${method}`)
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(rpcErr(null, -32700, 'Parse error'), { status: 400, headers: CORS }) }

  // Support a single message or a JSON-RPC batch.
  const batch = Array.isArray(body) ? body as Rpc[] : [body as Rpc]
  const results = (await Promise.all(batch.map(m => handleOne(m, req)))).filter((r): r is object => r !== null)

  // All-notifications → 202 Accepted, no body (per Streamable HTTP).
  if (results.length === 0) return new NextResponse(null, { status: 202, headers: CORS })

  const payload = Array.isArray(body) ? results : results[0]
  return NextResponse.json(payload, { headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// This server has no server-initiated messages, so it doesn't offer an SSE stream.
export async function GET() {
  return new NextResponse('Method Not Allowed. POST JSON-RPC to this MCP endpoint.', { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
