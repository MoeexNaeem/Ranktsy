'use client'
import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { C } from '@/utils'

type FormType = 'login' | 'register' | 'forgot' | 'verify-otp' | 'reset'
interface Field { name: string; label: string; type: string; placeholder: string }

const FIELDS: Record<FormType, Field[]> = {
  login:        [{ name:'email',label:'Email',type:'email',placeholder:'you@example.com' },{ name:'password',label:'Password',type:'password',placeholder:'Your password' }],
  register:     [{ name:'name',label:'Full Name',type:'text',placeholder:'Jane Smith' },{ name:'email',label:'Email',type:'email',placeholder:'you@example.com' },{ name:'password',label:'Password',type:'password',placeholder:'Min 8 chars, 1 uppercase, 1 number' },{ name:'confirmPassword',label:'Confirm Password',type:'password',placeholder:'Repeat password' }],
  forgot:       [{ name:'email',label:'Email',type:'email',placeholder:'you@example.com' }],
  'verify-otp': [{ name:'code',label:'6-digit OTP',type:'text',placeholder:'000000' }],
  reset:        [{ name:'password',label:'New Password',type:'password',placeholder:'Min 8 chars, 1 uppercase, 1 number' },{ name:'confirmPassword',label:'Confirm Password',type:'password',placeholder:'Repeat new password' }],
}
const TITLES:    Record<FormType,string> = { login:'Welcome back', register:'Create your account', forgot:'Forgot password', 'verify-otp':'Enter your OTP', reset:'Set new password' }
const SUBTITLES: Record<FormType,string> = { login:'Log in to your Rankkw dashboard', register:'Start growing your Etsy shop with data', forgot:"We'll send a 6-digit code to your email", 'verify-otp':'Check your inbox for the code we sent', reset:'Choose a strong new password' }
const BUTTONS:   Record<FormType,string> = { login:'Log in →', register:'Create account →', forgot:'Send reset code →', 'verify-otp':'Verify code →', reset:'Reset password →' }
const ENDPOINTS: Record<FormType,string> = { login:'/api/auth/login', register:'/api/auth/register', forgot:'/api/auth/forgot-password', 'verify-otp':'/api/auth/verify-otp', reset:'/api/auth/reset-password' }

function AuthFormInner({ type, email: initEmail, onNext }: { type: FormType; email?: string; onNext?: (email: string) => void }) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? '/dashboard'

  const [values,  setValues]  = useState<Record<string,string>>(initEmail ? { email: initEmail } : {})
  const [errors,  setErrors]  = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const set = useCallback((k: string, v: string) => {
    setValues(p => ({ ...p, [k]: v }))
    setErrors(p => { const n = { ...p }; delete n[k]; return n })
  }, [])

  const submit = useCallback(async () => {
    setLoading(true); setErrors({}); setSuccess('')
    const body: Record<string,string> = { ...values }
    if (type === 'verify-otp' || type === 'reset') body.email = initEmail ?? ''
    if (type === 'verify-otp') body.type = 'reset'
    try {
      const res  = await fetch(ENDPOINTS[type], { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) })
      const json = await res.json()
      if (!json.success) { setErrors(json.errors ?? { _: json.error ?? 'Something went wrong' }); return }
      if (type === 'login' || type === 'register') { router.push(redirect); router.refresh(); return }
      if (type === 'forgot')     { setSuccess('OTP sent! Check your inbox.'); onNext?.(values.email); return }
      if (type === 'verify-otp') { setSuccess('Code verified!'); onNext?.(initEmail ?? ''); return }
      if (type === 'reset')      { setSuccess('Password reset! Redirecting to login...'); setTimeout(() => router.push('/login'), 2000) }
    } catch { setErrors({ _: 'Network error. Please try again.' }) }
    finally  { setLoading(false) }
  }, [values, type, initEmail, router, redirect, onNext])

  const S = {
    wrap:  { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.canvas, padding:24 } as const,
    card:  { background:C.paper, borderRadius:24, padding:'44px 40px', width:'100%', maxWidth:440, border:`1px solid ${C.hairInk}` } as const,
    label: { display:'block', fontSize:11, fontFamily:"'General Sans',monospace", fontWeight:500, textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#6E6E64', marginBottom:8 } as const,
    input: { width:'100%', border:`1px solid ${C.hair}`, borderRadius:8, padding:'12px 14px', fontSize:14, fontFamily:'inherit', outline:'none', background:C.canvas, color:'#1a1a1a', transition:'border-color 0.15s', boxSizing:'border-box' } as const,
    btn:   { width:'100%', background: C.orange, color:'#fff', border:'none', borderRadius:28, padding:'14px', fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'inherit', marginTop:24, transition:'opacity 0.18s', letterSpacing:'-0.01em' } as const,
    link:  { color:C.ink, fontSize:13.5, textDecoration:'none', fontWeight:500 } as const,
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:32, textDecoration:'none' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:11, fontFamily:"'General Sans',monospace", fontWeight:500, textTransform:'uppercase', letterSpacing:'0.09em', color:'#6E6E64' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:C.orange, display:'inline-block' }} />
            Rankkw
          </span>
        </Link>
        <h1 style={{ fontSize:32, fontWeight:500, color:C.ink, letterSpacing:'-0.03em', marginBottom:8, lineHeight:1.05 }}>{TITLES[type]}</h1>
        <p style={{ fontSize:15, color:'#6E6E64', marginBottom:30, lineHeight:1.5, letterSpacing:'-0.1px' }}>{SUBTITLES[type]}</p>

        {success  && <div style={{ background:C.orange, color:C.snow, borderRadius:10, padding:'12px 16px', fontSize:13.5, marginBottom:16 }}>✓ {success}</div>}
        {errors._ && <div style={{ background:'#fff0f0', color:'#c00', borderRadius:10, padding:'12px 16px', fontSize:13.5, marginBottom:16 }}>⚠ {errors._}</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {FIELDS[type].map(field => (
            <div key={field.name}>
              <label style={S.label}>{field.label}</label>
              <input type={field.type} placeholder={field.placeholder} value={values[field.name]??''}
                onChange={e => set(field.name, e.target.value)} onKeyDown={e => e.key==='Enter'&&submit()}
                style={{ ...S.input, ...(errors[field.name] ? { borderColor:'#c00' } : {}) }}
                maxLength={field.name==='code'?6:200} />
              {errors[field.name] && <p style={{ fontSize:12, color:'#c00', marginTop:4 }}>{errors[field.name]}</p>}
            </div>
          ))}
        </div>

        <button style={{ ...S.btn, opacity:loading?0.7:1 }} onClick={submit} disabled={loading}>
          {loading ? 'Please wait...' : BUTTONS[type]}
        </button>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:20 }}>
          {type==='login'    && <><Link href="/register" style={S.link}>Create account</Link><Link href="/forgot-password" style={{ ...S.link, color:'#888', fontWeight:400 }}>Forgot password?</Link></>}
          {type==='register' && <Link href="/login" style={S.link}>Already have an account? Log in</Link>}
          {type==='forgot'   && <Link href="/login" style={S.link}>← Back to login</Link>}
          {type==='reset'    && <Link href="/login" style={S.link}>← Back to login</Link>}
        </div>
      </div>
    </div>
  )
}

export interface AuthFormProps { type: FormType; email?: string; onNext?: (email: string) => void }

export function AuthForm(props: AuthFormProps) {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.canvas }}><div className="shimmer" style={{ width:440, height:520, borderRadius:24, background:'#e8e7e2' }} /></div>}>
      <AuthFormInner {...props} />
    </Suspense>
  )
}
