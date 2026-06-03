import bcrypt from 'bcryptjs'

const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed)
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
