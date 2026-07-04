import type { AuthUser } from '@/types'

/**
 * Emails listed in ADMIN_EMAILS (comma-separated, case-insensitive) are always
 * treated as admins. This is the bootstrap mechanism — it lets you grant the
 * first admin without touching the database. A user's stored `role` can also be
 * 'admin' (set via the admin dashboard).
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

/** Effective role: env admin-list overrides, otherwise the stored DB role. */
export function resolveRole(email: string, dbRole?: 'user' | 'admin'): 'user' | 'admin' {
  if (isAdminEmail(email)) return 'admin'
  return dbRole === 'admin' ? 'admin' : 'user'
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return !!user && (user.role === 'admin' || isAdminEmail(user.email))
}
