import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { connectDB } from '@/lib/db'
import { Notification, ChatMessage } from '@/lib/models'
import { notifUnreadCount, chatUnreadCount, notifAudienceFilter, serializeNotif, serializeChat } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Server-Sent Events stream. The browser opens ONE EventSource here; we poll Mongo
// every few seconds for new notifications and chat messages addressed to this viewer
// and push them as events. Polling Mongo (not an in-process bus) is what makes it work
// across every PM2 cluster worker with no extra infrastructure.
const POLL_MS = 3000
const HEARTBEAT_MS = 25_000
const MAX_LIFE_MS = 5 * 60_000 // client's EventSource auto-reconnects after we close

export async function GET(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return new Response('Unauthorized', { status: 401 })
  const admin = isAdmin(user)

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      let poll: ReturnType<typeof setInterval> | null = null
      let beat: ReturnType<typeof setInterval> | null = null
      let life: ReturnType<typeof setTimeout> | null = null

      const cleanup = () => {
        if (closed) return
        closed = true
        if (poll) clearInterval(poll)
        if (beat) clearInterval(beat)
        if (life) clearTimeout(life)
        try { controller.close() } catch { /* already closed */ }
      }

      const send = (event: string, data: unknown) => {
        if (closed) return
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) }
        catch { cleanup() }
      }

      req.signal.addEventListener('abort', cleanup)

      try {
        await connectDB()
      } catch {
        cleanup(); return
      }

      let notifCursor = new Date()
      let chatCursor = new Date()

      // Initial snapshot so the badges are correct the moment the page connects.
      send('init', {
        admin,
        notifUnread: await notifUnreadCount(user).catch(() => 0),
        chatUnread: await chatUnreadCount(user).catch(() => 0),
      })

      const tick = async () => {
        if (closed) return
        try {
          const notifs = await Notification
            .find({ ...notifAudienceFilter(user), createdAt: { $gt: notifCursor } })
            .sort({ createdAt: 1 }).limit(25).lean()
          if (notifs.length) {
            notifCursor = new Date(Math.max(...notifs.map(n => new Date(n.createdAt as Date).getTime())))
            for (const n of notifs) {
              if (!(n.readBy ?? []).includes(user.id)) send('notification', serializeNotif(n))
            }
            send('notif-count', { unread: await notifUnreadCount(user).catch(() => 0) })
          }

          const msgs = admin
            ? await ChatMessage.find({ sender: 'user', createdAt: { $gt: chatCursor } }).sort({ createdAt: 1 }).limit(40).lean()
            : await ChatMessage.find({ userId: user.id, sender: 'admin', createdAt: { $gt: chatCursor } }).sort({ createdAt: 1 }).limit(40).lean()
          if (msgs.length) {
            chatCursor = new Date(Math.max(...msgs.map(m => new Date(m.createdAt as Date).getTime())))
            for (const m of msgs) send('chat', serializeChat(m))
            send('chat-count', { unread: await chatUnreadCount(user).catch(() => 0) })
          }
        } catch { /* transient DB error: keep the stream alive, retry next tick */ }
      }

      poll = setInterval(tick, POLL_MS)
      beat = setInterval(() => { if (!closed) { try { controller.enqueue(encoder.encode(': ping\n\n')) } catch { cleanup() } } }, HEARTBEAT_MS)
      life = setTimeout(cleanup, MAX_LIFE_MS)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
