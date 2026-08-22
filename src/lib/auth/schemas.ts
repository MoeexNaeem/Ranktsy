import { z } from 'zod'

/**
 * Strong-password rule for NEW passwords (signup + reset). Existing accounts are
 * grandfathered - login only checks the password matches, never re-validates it.
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

/**
 * Signup email policy (anti-abuse): allow any real email - the major consumer
 * providers (Gmail, Outlook, Yahoo, iCloud, Yandex…) AND legitimate business /
 * company domains (you@yourcompany.com) - while blocking known disposable /
 * throwaway providers. Existing accounts are unaffected - login never re-checks
 * the domain. Shared by the client, the register route and the OAuth signup flow.
 */
export const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'tempmailo.com',
  'tempr.email', 'throwawaymail.com', 'yopmail.com', 'getnada.com', 'nada.email',
  'trashmail.com', 'trashmail.de', 'sharklasers.com', 'maildrop.cc', 'mailcatch.com',
  'dispostable.com', 'fakeinbox.com', 'mailnesia.com', 'mohmal.com', 'emailondeck.com',
  'tempinbox.com', 'spamgourmet.com', 'mytemp.email', 'moakt.com', 'discard.email',
  '1secmail.com', 'mailtemp.info', 'inboxkitten.com', 'burnermail.io', 'mintemail.com',
  'spam4.me', 'grr.la', 'einrot.com', 'tmail.ws', 'tmails.net', 'harakirimail.com',
] as const

export const EMAIL_DOMAIN_MESSAGE =
  'Please use a permanent email address - temporary / disposable email providers aren’t allowed.'

/** Allowed to create a NEW account? True for any valid domain that isn't disposable. */
export function isAllowedEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (!domain || !domain.includes('.')) return false
  // Block the domain itself and any subdomain of a disposable provider.
  return !(DISPOSABLE_EMAIL_DOMAINS as readonly string[]).some(d => domain === d || domain.endsWith('.' + d))
}

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: strongPassword,
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine(d => isAllowedEmailDomain(d.email), {
  message: EMAIL_DOMAIN_MESSAGE,
  path: ['email'],
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
