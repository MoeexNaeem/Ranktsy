import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { isDisposableEmail } from '@/lib/auth/disposable'

/**
 * Remembers temp-mail accounts an admin deleted, so their owner trying to log in
 * is told why (instead of a plain "invalid email or password") and pointed to a
 * real email or Google sign-in. Kept for a year, then forgotten.
 */
type Tombstone = { _id: string; reason: 'temp_mail'; deletedAt: Date }
let indexed = false

async function col() {
  await connectDB()
  const c = mongoose.connection.db!.collection<Tombstone>('deletedaccounts')
  if (!indexed) { indexed = true; c.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 365 * 86_400 }).catch(() => { indexed = false }) }
  return c
}

/** Record the temp-mail ones among just-deleted accounts (others are ignored). */
export async function rememberDeletedTempAccounts(emails: string[]): Promise<void> {
  const temp = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(e => e && isDisposableEmail(e)))]
  if (!temp.length) return
  try {
    const c = await col()
    const now = new Date()
    await c.bulkWrite(temp.map(email => ({
      updateOne: { filter: { _id: email }, update: { $set: { reason: 'temp_mail' as const, deletedAt: now } }, upsert: true },
    })), { ordered: false })
  } catch (e) {
    console.error('[deleted-accounts] could not record:', e instanceof Error ? e.message : e)
  }
}

/** True when this email belonged to a temp-mail account an admin deleted. */
export async function wasDeletedTempAccount(email: string): Promise<boolean> {
  try { return !!(await (await col()).findOne({ _id: email.trim().toLowerCase() })) } catch { return false }
}

export const DELETED_TEMP_MESSAGE =
  'This account was removed because it was created with a temporary email address. Temporary emails are not allowed on Rankkw. Please create a new account with your real email (Gmail, Outlook, Yahoo...) or use “Continue with Google”.'
export const TEMP_LOGIN_MESSAGE =
  'Temporary email addresses can’t be used on Rankkw. Please create an account with your real email (Gmail, Outlook, Yahoo...) or use “Continue with Google”.'
