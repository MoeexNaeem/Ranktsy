import { connectDB } from '@/lib/db'
import { Notification, ChatMessage } from '@/lib/models'
import type { AuthUser } from '@/types'
import { isAdmin } from '@/lib/auth/roles'

/**
 * Notification + chat helpers, shared by the admin actions that raise notifications,
 * the REST endpoints, and the SSE stream. Delivery is "SSE + Mongo": writers persist a
 * row here, and each viewer's SSE loop polls Mongo for new rows (so it works across
 * every PM2 cluster worker without extra infra).
 */
export interface NotifInput {
  audience?: 'all' | 'user' | 'admin'
  userId?: string | null
  type?: string
  title: string
  body?: string
  link?: string
}

// Which notifications a viewer should see: broadcasts, their own targeted ones, and
// (for admins) admin-only notifications such as "new message from a user".
export function notifAudienceFilter(user: AuthUser): Record<string, unknown> {
  const or: Record<string, unknown>[] = [{ audience: 'all' }, { userId: user.id }]
  if (isAdmin(user)) or.push({ audience: 'admin' })
  return { $or: or }
}

export async function createNotification(input: NotifInput) {
  await connectDB()
  return Notification.create({
    audience: input.audience ?? (input.userId ? 'user' : 'all'),
    userId: input.userId ?? null,
    type: input.type ?? 'info',
    title: input.title,
    body: input.body,
    link: input.link,
    readBy: [],
  })
}

/** Broadcast to every user (and admins). Best-effort: never throws into the caller. */
export async function notifyAll(title: string, body?: string, link?: string, type = 'info') {
  try { await createNotification({ audience: 'all', title, body, link, type }) } catch { /* ignore */ }
}

/** Notify one user. Best-effort. */
export async function notifyUser(userId: string, title: string, body?: string, link?: string, type = 'info') {
  try { await createNotification({ audience: 'user', userId, title, body, link, type }) } catch { /* ignore */ }
}

/** Notify every admin (audience 'admin'), e.g. a new support message. Best-effort. */
export async function notifyAdmins(title: string, body?: string, link?: string, type = 'info') {
  try { await createNotification({ audience: 'admin', title, body, link, type }) } catch { /* ignore */ }
}

/** Count of notifications this viewer has not yet read (broadcasts + personal + admin). */
export async function notifUnreadCount(user: AuthUser): Promise<number> {
  await connectDB()
  return Notification.countDocuments({ ...notifAudienceFilter(user), readBy: { $ne: user.id } })
}

/** Unread chat count: incoming admin replies for a user, or all unseen user messages for an admin. */
export async function chatUnreadCount(user: AuthUser): Promise<number> {
  await connectDB()
  if (isAdmin(user)) return ChatMessage.countDocuments({ sender: 'user', readByAdmin: false })
  return ChatMessage.countDocuments({ userId: user.id, sender: 'admin', readByUser: false })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeNotif(n: any) {
  return {
    id: String(n._id),
    type: n.type ?? 'info',
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    audience: n.audience,
    createdAt: n.createdAt ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeChat(m: any) {
  return {
    id: String(m._id),
    userId: m.userId,
    sender: m.sender as 'user' | 'admin',
    body: m.body,
    createdAt: m.createdAt ?? null,
  }
}
