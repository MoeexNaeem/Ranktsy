/**
 * Code Flow graph - the single source of truth for the admin "Code Flow" diagram.
 *
 * This is intentionally PLAIN DATA so the flow is easy to extend: to add a step,
 * add a node here and an edge connecting it. Nothing else needs to change - the
 * <CodeFlow> component renders whatever is in these two arrays, and colours each
 * node/edge live from subsystem health (see /api/admin/health-flow).
 *
 * Layout is manual (x/y) so related steps stay in tidy vertical lanes. Keep new
 * nodes inside a lane's x, stepping y by ~150 per step.
 *
 *   Lane x:  auth 80 · keyword 660 · ai 1240 · payments 1820 · infra 2400
 */

// A node's `system` decides its live colour. Omit it for pure application code
// (no external dependency) - those are always "healthy" because they can't be
// "down" independently of the code being deployed.
export type FlowSystem =
  | 'auth' | 'mongo' | 'etsy' | 'google' | 'gemini' | 'openai'
  | 'lemonsqueezy' | 'resend' | 'recaptcha' | 'redis'

export const SYSTEM_LABEL: Record<FlowSystem, string> = {
  auth:         'Auth / JWT',
  mongo:        'MongoDB',
  etsy:         'Etsy API pool',
  google:       'Google Ads',
  gemini:       'Gemini AI',
  openai:       'OpenAI images',
  lemonsqueezy: 'Lemon Squeezy',
  resend:       'Resend email',
  recaptcha:    'reCAPTCHA',
  redis:        'Upstash Redis',
}

// Shapes mirror the reference flowchart: rounded = entry/exit, diamond = branch,
// parallelogram = a message/queue hop, rect = a normal step, chip = external API.
export type FlowNodeKind = 'start' | 'process' | 'decision' | 'message' | 'external' | 'terminal'

export interface FlowNodeDef {
  id: string
  label: string
  kind: FlowNodeKind
  lane: 'auth' | 'keyword' | 'ai' | 'payments' | 'infra'
  system?: FlowSystem
  position: { x: number; y: number }
  detail?: string
}

export interface FlowEdgeDef {
  id: string
  source: string
  target: string
  label?: string
  /** Edge goes red when this system is down. Defaults to the target node's system. */
  system?: FlowSystem
}

const X = { auth: 80, keyword: 660, ai: 1240, payments: 1820, infra: 2400 } as const
const Y = (row: number) => 20 + row * 150
const OFFSET = 300   // horizontal nudge for a node that runs parallel to its lane

export const FLOW_NODES: FlowNodeDef[] = [
  // ── Auth lane ──────────────────────────────────────────────────────────────
  { id: 'signup',    label: 'Sign up',                         kind: 'start',    lane: 'auth', position: { x: X.auth, y: Y(0) }, detail: 'User submits the registration form.' },
  { id: 'register',  label: 'POST /api/auth/register',         kind: 'process',  lane: 'auth', position: { x: X.auth, y: Y(1) } },
  { id: 'captcha',   label: 'reCAPTCHA verify?',               kind: 'decision', lane: 'auth', system: 'recaptcha', position: { x: X.auth, y: Y(2) }, detail: 'Dormant until reCAPTCHA keys are set.' },
  { id: 'hibp',      label: 'HIBP breach check',               kind: 'process',  lane: 'auth', position: { x: X.auth, y: Y(3) }, detail: 'Reject known-breached passwords.' },
  { id: 'createUser',label: 'Create user',                     kind: 'process',  lane: 'auth', system: 'mongo', position: { x: X.auth, y: Y(4) } },
  { id: 'sendOtp',   label: 'Send OTP email',                  kind: 'external', lane: 'auth', system: 'resend', position: { x: X.auth, y: Y(5) } },
  { id: 'verifyOtp', label: 'Verify OTP',                      kind: 'process',  lane: 'auth', system: 'mongo', position: { x: X.auth, y: Y(6) } },
  { id: 'login',     label: 'POST /api/auth/login',            kind: 'process',  lane: 'auth', position: { x: X.auth, y: Y(7) } },
  { id: 'jwt',       label: 'Issue JWT (HttpOnly cookie)',     kind: 'process',  lane: 'auth', system: 'auth', position: { x: X.auth, y: Y(8) } },
  { id: 'dashboard', label: 'Dashboard loads',                 kind: 'process',  lane: 'auth', position: { x: X.auth, y: Y(9) } },
  { id: 'botBlocked',label: 'Blocked (bot)',                   kind: 'terminal', lane: 'auth', position: { x: X.auth - OFFSET, y: Y(3) } },

  // ── Keyword search lane ──────────────────────────────────────────────────────
  { id: 'kwUI',      label: 'Keyword Search',                  kind: 'start',    lane: 'keyword', position: { x: X.keyword, y: Y(0) } },
  { id: 'kwApi',     label: 'GET /api/keywords',               kind: 'process',  lane: 'keyword', position: { x: X.keyword, y: Y(1) } },
  { id: 'kwGuard',   label: 'guardSearch (rate + captcha)',    kind: 'process',  lane: 'keyword', system: 'recaptcha', position: { x: X.keyword, y: Y(2) } },
  { id: 'kwQuota',   label: 'Daily plan quota',                kind: 'process',  lane: 'keyword', system: 'mongo', position: { x: X.keyword, y: Y(3) } },
  { id: 'kwCore',    label: 'getKeywordCore()',                kind: 'process',  lane: 'keyword', position: { x: X.keyword, y: Y(4) } },
  { id: 'kwCache',   label: 'Cached?',                         kind: 'decision', lane: 'keyword', position: { x: X.keyword, y: Y(5) }, detail: 'memCache -> collective store -> Mongo KeywordCache.' },
  { id: 'kwDb',      label: 'KeywordCache (Mongo)',            kind: 'process',  lane: 'keyword', system: 'mongo', position: { x: X.keyword, y: Y(6) } },
  { id: 'kwEtsy',    label: 'Etsy key pool + rate gate',       kind: 'external', lane: 'keyword', system: 'etsy', position: { x: X.keyword, y: Y(7) } },
  { id: 'kwGoogle',  label: 'Google Ads volume',               kind: 'external', lane: 'keyword', system: 'google', position: { x: X.keyword + OFFSET, y: Y(7) } },
  { id: 'kwEnrich',  label: 'Related + near matches',          kind: 'process',  lane: 'keyword', system: 'etsy', position: { x: X.keyword, y: Y(8) } },
  { id: 'kwResult',  label: 'Results rendered',                kind: 'terminal', lane: 'keyword', position: { x: X.keyword, y: Y(9) } },

  // ── AI tools lane ────────────────────────────────────────────────────────────
  { id: 'aiUI',      label: 'AI tools (Listing Pro, Tags...)', kind: 'start',    lane: 'ai', position: { x: X.ai, y: Y(0) } },
  { id: 'aiApi',     label: 'POST /api/ai/*',                  kind: 'process',  lane: 'ai', position: { x: X.ai, y: Y(1) } },
  { id: 'aiCredits', label: 'withApiGuard credits',           kind: 'process',  lane: 'ai', system: 'mongo', position: { x: X.ai, y: Y(2) } },
  { id: 'aiGemini',  label: 'Gemini key pool',                 kind: 'external', lane: 'ai', system: 'gemini', position: { x: X.ai, y: Y(3) } },
  { id: 'aiImage',   label: 'OpenAI hero image',               kind: 'external', lane: 'ai', system: 'openai', position: { x: X.ai + OFFSET, y: Y(3) }, detail: 'Etsy Listing Pro only.' },
  { id: 'aiCharge',  label: 'Charge credits on success',       kind: 'process',  lane: 'ai', system: 'mongo', position: { x: X.ai, y: Y(4) } },
  { id: 'aiResult',  label: 'Generation returned',             kind: 'terminal', lane: 'ai', position: { x: X.ai, y: Y(5) } },

  // ── Payments lane ────────────────────────────────────────────────────────────
  { id: 'pricing',   label: 'Pricing page',                    kind: 'start',    lane: 'payments', position: { x: X.payments, y: Y(0) } },
  { id: 'lsCheckout',label: 'Lemon Squeezy checkout',          kind: 'external', lane: 'payments', system: 'lemonsqueezy', position: { x: X.payments, y: Y(1) } },
  { id: 'lsWebhook', label: 'Signed webhook',                  kind: 'message',  lane: 'payments', system: 'lemonsqueezy', position: { x: X.payments, y: Y(2) } },
  { id: 'assignPlan',label: 'Assign plan',                     kind: 'process',  lane: 'payments', system: 'mongo', position: { x: X.payments, y: Y(3) } },
  { id: 'lifecycle', label: 'Plan expiry lifecycle',           kind: 'process',  lane: 'payments', position: { x: X.payments, y: Y(4) }, detail: 'Auto-reverts to free at term end.' },
  { id: 'planActive',label: 'Plan active',                     kind: 'terminal', lane: 'payments', position: { x: X.payments, y: Y(5) } },
]

export const FLOW_EDGES: FlowEdgeDef[] = [
  // Auth
  { id: 'e1', source: 'signup', target: 'register' },
  { id: 'e2', source: 'register', target: 'captcha' },
  { id: 'e3', source: 'captcha', target: 'hibp', label: 'Human' },
  { id: 'e3b', source: 'captcha', target: 'botBlocked', label: 'Bot' },
  { id: 'e4', source: 'hibp', target: 'createUser' },
  { id: 'e5', source: 'createUser', target: 'sendOtp' },
  { id: 'e6', source: 'sendOtp', target: 'verifyOtp' },
  { id: 'e7', source: 'verifyOtp', target: 'login' },
  { id: 'e8', source: 'login', target: 'jwt' },
  { id: 'e9', source: 'jwt', target: 'dashboard' },
  // Dashboard fans out into the tools
  { id: 'x1', source: 'dashboard', target: 'kwUI' },
  { id: 'x2', source: 'dashboard', target: 'aiUI' },
  { id: 'x3', source: 'dashboard', target: 'pricing' },
  // Keyword
  { id: 'k1', source: 'kwUI', target: 'kwApi' },
  { id: 'k2', source: 'kwApi', target: 'kwGuard' },
  { id: 'k3', source: 'kwGuard', target: 'kwQuota' },
  { id: 'k4', source: 'kwQuota', target: 'kwCore' },
  { id: 'k5', source: 'kwCore', target: 'kwCache' },
  { id: 'k6', source: 'kwCache', target: 'kwResult', label: 'Hit' },
  { id: 'k7', source: 'kwCache', target: 'kwDb', label: 'Miss' },
  { id: 'k8', source: 'kwDb', target: 'kwEtsy' },
  { id: 'k9', source: 'kwEtsy', target: 'kwGoogle' },
  { id: 'k10', source: 'kwEtsy', target: 'kwEnrich' },
  { id: 'k11', source: 'kwGoogle', target: 'kwEnrich' },
  { id: 'k12', source: 'kwEnrich', target: 'kwResult' },
  // AI
  { id: 'a1', source: 'aiUI', target: 'aiApi' },
  { id: 'a2', source: 'aiApi', target: 'aiCredits' },
  { id: 'a3', source: 'aiCredits', target: 'aiGemini' },
  { id: 'a4', source: 'aiGemini', target: 'aiImage' },
  { id: 'a5', source: 'aiGemini', target: 'aiCharge' },
  { id: 'a6', source: 'aiImage', target: 'aiCharge' },
  { id: 'a7', source: 'aiCharge', target: 'aiResult' },
  // Payments
  { id: 'p1', source: 'pricing', target: 'lsCheckout' },
  { id: 'p2', source: 'lsCheckout', target: 'lsWebhook' },
  { id: 'p3', source: 'lsWebhook', target: 'assignPlan' },
  { id: 'p4', source: 'assignPlan', target: 'lifecycle' },
  { id: 'p5', source: 'lifecycle', target: 'planActive' },
]
