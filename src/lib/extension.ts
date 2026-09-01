import type { NextRequest } from 'next/server'
import { connectDB } from '@/lib/db'
import { ExtensionUsage } from '@/lib/models'

/**
 * Extension usage tracking. The "Rankkw for Etsy" browser extension calls our API
 * authenticated as the logged-in user (session cookie), so we can attribute its
 * traffic without any account linkage. We identify an extension request by:
 *   - a browser-extension Origin (chrome-extension:// etc.), or
 *   - an explicit X-Rankkw-Ext-Version header (add this in the extension for the
 *     richest data: exact version), or
 *   - the extension-only /api/etsy/observe endpoint.
 */
export function detectExtension(req: NextRequest): { isExt: boolean; version: string | null; extId: string | null } {
  const origin = req.headers.get('origin') || ''
  const verHeader = req.headers.get('x-rankkw-ext-version') || req.headers.get('x-rankkw-extension') || ''
  let path = ''
  try { path = new URL(req.url).pathname } catch { /* ignore */ }

  const fromOrigin =
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('moz-extension://') ||
    origin.startsWith('safari-web-extension://')
  const isExt = fromOrigin || !!verHeader || path === '/api/etsy/observe'
  const extId = fromOrigin ? (origin.split('//')[1]?.slice(0, 128) || null) : null
  const version = verHeader ? verHeader.slice(0, 32) : null
  return { isExt, version, extId }
}

// Throttle DB writes to at most one per user per window (per worker). `hits` therefore
// counts active windows, not raw requests, which is plenty for admin visibility and
// keeps this off the hot path under load.
const WINDOW_MS = 60_000
const lastWrite = new Map<string, number>()

/**
 * Fire-and-forget: record that `userId` used the extension on this request. Never
 * throws (tracking must not break the request it rides on). Pass force=true from the
 * observe route, which is unambiguously the extension.
 */
export async function recordExtensionUsage(req: NextRequest, userId: string, force = false): Promise<void> {
  const info = detectExtension(req)
  if (!info.isExt && !force) return

  const now = Date.now()
  if (now - (lastWrite.get(userId) ?? 0) < WINDOW_MS) return
  lastWrite.set(userId, now)

  let path: string | null = null
  try { path = new URL(req.url).pathname } catch { /* ignore */ }

  try {
    await connectDB()
    await ExtensionUsage.updateOne(
      { userId },
      {
        $set: {
          lastSeenAt: new Date(),
          ...(info.version ? { version: info.version } : {}),
          ...(info.extId ? { extensionId: info.extId } : {}),
          ...(path ? { lastEndpoint: path } : {}),
        },
        $inc: { hits: 1 },
        $setOnInsert: { firstSeenAt: new Date() },
      },
      { upsert: true },
    )
  } catch { /* swallow: tracking is best-effort */ }
}
