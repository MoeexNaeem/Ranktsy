'use client'
import { useState } from 'react'
import { AuthForm } from '@/components/auth/AuthForm'

type Step = 'forgot' | 'verify-otp' | 'reset'

export default function ForgotPasswordPage() {
  const [step,  setStep]  = useState<Step>('forgot')
  const [email, setEmail] = useState('')

  if (step === 'forgot')
    return <AuthForm type="forgot" onNext={e => { setEmail(e); setStep('verify-otp') }} />

  if (step === 'verify-otp')
    return <AuthForm type="verify-otp" email={email} onNext={() => setStep('reset')} />

  return <AuthForm type="reset" email={email} />
}
