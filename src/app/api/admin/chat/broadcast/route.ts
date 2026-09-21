import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ChatMessage, Notification, User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { notifyAll } from '@/lib/notify'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Insert in chunks: one insertMany of 20k docs is a single huge op that can stall. */
const CHUNK = 1000

type Audience = 'all' | 'sebt'

async function guard() {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), user: null }
  if (!isAdmin(user)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), user: null }
  return { error: null, user }
}

/** Recipients for an audience, minus the admin sending it: an announcement landing
 *  in your own support thread is just confusing. */
const filterFor = (a: Audience, senderId?: string) => ({
  ...(a === 'sebt' ? { sebtStudent: true } : {}),
  ...(senderId ? { _id: { $ne: senderId } } : {}),
})

/** How many people each audience currently covers, for the composer's labels. */
export async function GET(): Promise<NextResponse<ApiResponse<{ all: number; sebt: number }>>> {
  const g = await guard(); if (g.error) return g.error
  try {
    await connectDB()
    const [all, sebt] = await Promise.all([
      User.countDocuments(filterFor('all', g.user?.id)),
      User.countDocuments(filterFor('sebt', g.user?.id)),
    ])
    return NextResponse.json({ success: true, data: { all, sebt } })
  } catch (e) {
    console.error('[Admin] chat broadcast GET:', e)
    return NextResponse.json({ success: false, error: 'Could not load audience sizes.' }, { status: 500 })
  }
}

/**
 * Send one chat message into EVERY recipient's support thread at once.
 *   { body, audience: 'all' | 'sebt' }
 *
 * Unlike /api/admin/notifications (which writes a single broadcast row that every
 * viewer reads), a chat broadcast has to write one message per user, because each
 * thread is keyed by userId and each recipient reads and replies to their own copy.
 * They are stamped `broadcast`, so both sides render them blue and a reply comes
 * back as a normal one-to-one message.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ sent: number; audience: Audience }>>> {
  const g = await guard(); if (g.error) return g.error

  const raw = await req.json().catch(() => ({}))
  const text = String(raw?.body ?? '').trim()
  const audience: Audience = raw?.audience === 'sebt' ? 'sebt' : 'all'

  if (!text) return NextResponse.json({ success: false, error: 'Message is empty.' }, { status: 400 })
  if (text.length > 4000) return NextResponse.json({ success: false, error: 'Message is too long.' }, { status: 400 })

  try {
    await connectDB()
    const recipients = await User.find(filterFor(audience, g.user?.id)).select('_id').lean<{ _id: unknown }[]>()
    if (!recipients.length) {
      return NextResponse.json({ success: false, error: audience === 'sebt' ? 'There are no SEBT students yet.' : 'There are no users yet.' }, { status: 400 })
    }

    const now = new Date()
    const docs = recipients.map(u => ({
      userId: String(u._id),
      sender: 'admin' as const,
      body: text,
      readByUser: false,
      readByAdmin: true,
      broadcast: audience,
      createdAt: now,
      updatedAt: now,
    }))

    let sent = 0
    for (let i = 0; i < docs.length; i += CHUNK) {
      const slice = docs.slice(i, i + CHUNK)
      // ordered:false so one bad doc cannot abort the rest of the batch.
      const r = await ChatMessage.insertMany(slice, { ordered: false })
      sent += r.length
    }

    // Raise the bell too, not just the chat badge. "All" is a single broadcast row;
    // SEBT has to be per-user, since notifications have no student audience.
    const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text
    if (audience === 'all') {
      void notifyAll('Message from Rankkw', preview, undefined, 'chat')
    } else {
      const notifs = recipients.map(u => ({
        audience: 'user' as const, userId: String(u._id), type: 'chat',
        title: 'Message from Rankkw', body: preview, readBy: [] as string[],
        createdAt: now, updatedAt: now,
      }))
      for (let i = 0; i < notifs.length; i += CHUNK) {
        await Notification.insertMany(notifs.slice(i, i + CHUNK), { ordered: false }).catch(() => null)
      }
    }

    return NextResponse.json({ success: true, data: { sent, audience } })
  } catch (e) {
    console.error('[Admin] chat broadcast POST:', e)
    return NextResponse.json({ success: false, error: 'Could not send the message.' }, { status: 500 })
  }
}
