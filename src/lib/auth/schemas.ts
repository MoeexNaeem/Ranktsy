import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
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
  password:        z.string().min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number'),
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
