import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed)
}

export function generateOTP(): string {
  // Cryptographically-secure so codes can't be predicted from a PRNG sequence.
  return crypto.randomInt(100000, 1000000).toString()
}
