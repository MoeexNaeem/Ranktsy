import { z } from 'zod'

/**
 * Strong-password rule for NEW passwords (signup + reset). Existing accounts are
 * grandfathered — login only checks the password matches, never re-validates it.
 * Client and server share this exact rule via the regexes below.
 */
export const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8,        label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p),      label: 'One uppercase letter' },
  { test: (p: string) => /[0-9]/.test(p),      label: 'One number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'One special character' },
] as const

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: strongPassword,
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  email:    z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
})

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code:  z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
  type:  z.enum(['reset', 'verify']),
})

export const resetPasswordSchema = z.object({
  email:           z.string().email(),
  code:            z.string().length(6),
  password:        strongPassword,
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type RegisterInput        = z.infer<typeof registerSchema>
export type LoginInput           = z.infer<typeof loginSchema>
export type ForgotPasswordInput  = z.infer<typeof forgotPasswordSchema>
export type VerifyOtpInput       = z.infer<typeof verifyOtpSchema>
export type ResetPasswordInput   = z.infer<typeof resetPasswordSchema>
