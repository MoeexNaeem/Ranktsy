import crypto from 'crypto'

/**
 * Small AES-256-GCM helper used to encrypt third-party OAuth tokens (Etsy) at
 * rest in MongoDB. The key is derived from JWT_SECRET (or TOKEN_ENC_KEY if set)
 * so no extra configuration is required, while still keeping raw tokens out of
 * the database in plaintext.
 *
 * Format: base64( iv[12] | authTag[16] | ciphertext ), prefixed with "enc:v1:".
 */
const PREFIX = 'enc:v1:'

function key(): Buffer {
  const secret = process.env.TOKEN_ENC_KEY || process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars'
  return crypto.createHash('sha256').update(secret).digest() // 32 bytes
}

export function encryptSecret(plain: string): string {
  if (!plain) return plain
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptSecret(stored: string | undefined | null): string | null {
  if (!stored) return null
  // Backward-compatible: tokens saved before encryption (no prefix) pass through.
  if (!stored.startsWith(PREFIX)) return stored
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64')
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const enc = raw.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
