'use client'
import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { C } from '@/utils'
import { PASSWORD_RULES } from '@/lib/auth/schemas'
import { Recaptcha, RECAPTCHA_ENABLED } from '@/components/security/Recaptcha'

type FormType = 'login' | 'register' | 'forgot' | 'verify-otp' | 'reset'
interface Field { name: string; label: string; type: string; placeholder: string }

const GREEN = '#1F8A4C'
const RED   = '#c0392b'

const OAUTH_ERRORS: Record<string, string> = {
  oauth_unavailable: 'That sign-in option isn’t available right now.',
  oauth_denied:      'Sign-in was cancelled. Please try again.',
  oauth_state:       'Your sign-in session expired. Please try again.',
  oauth_failed:      'We couldn’t sign you in with that provider. Please try again.',
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}
function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}
function OAuthButton({ provider, label, redirect }: { provider: 'google' | 'microsoft'; label: string; redirect: string }) {
  return (
    <a href={`/api/auth/oauth/${provider}?redirect=${encodeURIComponent(redirect)}`}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', border:`1px solid ${C.hair}`, background:'#fff', borderRadius:28, padding:'12px 14px', fontSize:14.5, fontWeight:500, color:C.ink, textDecoration:'none', fontFamily:'inherit', transition:'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = C.bone)}
      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
      {provider === 'google' ? <GoogleLogo /> : <MicrosoftLogo />}
      {label}
    </a>
  )
}

// SHA-1 hex (Web Crypto) for the HIBP k-anonymity check — only the first 5 chars
// are ever sent to the API, never the password.
async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Four-point sparkle used in the backdrop.
function Sparkle({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 0c.6 6 5.4 10.8 12 12-6.6 1.2-11.4 6-12 12-.6-6-5.4-10.8-12-12C6.6 10.8 11.4 6 12 0z" />
    </svg>
  )
}

// Show/hide-password eye toggle. `off` = password currently visible (crossed eye).
function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// Decorative, on-palette backdrop (dotted grid + colour blobs + dashed rings +
// floating shapes + sparkles). Purely visual — aria-hidden, no pointer events.
// A few pieces gently float via the shared .float-card class (auto-disabled for
// prefers-reduced-motion).
function AuthBackdrop() {
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      {/* dotted grid */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(61,62,59,0.09) 1px, transparent 1px)', backgroundSize:'22px 22px' }} />

      {/* soft colour blobs (brighter than before) */}
      <div style={{ position:'absolute', top:'-14%', left:'-10%', width:520, height:520, background:'radial-gradient(50% 50% at 50% 50%, rgba(251,94,9,0.28), transparent 70%)' }} />
      <div style={{ position:'absolute', bottom:'-18%', right:'-8%', width:560, height:560, background:'radial-gradient(50% 50% at 50% 50%, rgba(59,91,255,0.24), transparent 70%)' }} />
      <div style={{ position:'absolute', top:'44%', right:'12%', width:360, height:360, background:'radial-gradient(50% 50% at 50% 50%, rgba(46,125,70,0.20), transparent 70%)' }} />
      <div style={{ position:'absolute', bottom:'6%', left:'16%', width:300, height:300, background:'radial-gradient(50% 50% at 50% 50%, rgba(251,94,9,0.16), transparent 70%)' }} />

      {/* dashed rings */}
      <svg className="float-card" style={{ position:'absolute', top:'6%', right:'8%', ['--dur' as string]:'7s' }} width="190" height="190" viewBox="0 0 190 190" fill="none">
        <circle cx="95" cy="95" r="82" stroke="#FB5E09" strokeWidth="1.6" strokeDasharray="4 10" opacity="0.6" />
      </svg>
      <svg className="float-card" style={{ position:'absolute', bottom:'8%', right:'22%', ['--dur' as string]:'9s', ['--delay' as string]:'0.8s' }} width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="52" stroke="#3B5BFF" strokeWidth="1.6" strokeDasharray="2 9" opacity="0.55" />
      </svg>
      <svg style={{ position:'absolute', top:'14%', left:'8%' }} width="96" height="96" viewBox="0 0 96 96" fill="none">
        <circle cx="48" cy="48" r="40" stroke="#2E7D46" strokeWidth="1.5" strokeDasharray="3 8" opacity="0.5" />
      </svg>

      {/* dashed curves */}
      <svg style={{ position:'absolute', bottom:'7%', left:'4%' }} width="230" height="140" viewBox="0 0 230 140" fill="none">
        <path d="M10 118 C 70 20, 160 20, 220 118" stroke="#2E7D46" strokeWidth="1.6" strokeDasharray="3 9" opacity="0.55" />
      </svg>
      <svg style={{ position:'absolute', top:'20%', right:'26%' }} width="180" height="90" viewBox="0 0 180 90" fill="none">
        <path d="M4 60 C 50 6, 130 84, 176 30" stroke="#FB5E09" strokeWidth="1.5" strokeDasharray="2 8" opacity="0.5" />
      </svg>

      {/* solid + outline geometric shapes */}
      <div className="float-card" style={{ position:'absolute', top:'30%', left:'18%', width:26, height:26, borderRadius:8, border:'2px solid rgba(59,91,255,0.5)', transform:'rotate(18deg)', ['--dur' as string]:'6s' }} />
      <div className="float-card" style={{ position:'absolute', bottom:'30%', right:'12%', width:20, height:20, borderRadius:6, background:'rgba(251,94,9,0.5)', transform:'rotate(-12deg)', ['--dur' as string]:'8s', ['--delay' as string]:'0.5s' }} />
      <div style={{ position:'absolute', top:'70%', left:'12%', width:14, height:14, borderRadius:'50%', background:'rgba(46,125,70,0.55)' }} />
      <div style={{ position:'absolute', top:'12%', left:'34%', width:10, height:10, borderRadius:'50%', background:'rgba(59,91,255,0.5)' }} />
      <div style={{ position:'absolute', bottom:'16%', left:'40%', width:8, height:8, borderRadius:'50%', background:'rgba(251,94,9,0.55)' }} />

      {/* sparkles */}
      <span className="float-card" style={{ position:'absolute', top:'22%', right:'16%', opacity:0.7, ['--dur' as string]:'5s' }}><Sparkle color="#FB5E09" size={22} /></span>
      <span className="float-card" style={{ position:'absolute', bottom:'22%', left:'24%', opacity:0.6, ['--dur' as string]:'6.5s', ['--delay' as string]:'0.6s' }}><Sparkle color="#3B5BFF" size={16} /></span>
      <span style={{ position:'absolute', top:'54%', right:'30%', opacity:0.55 }}><Sparkle color="#2E7D46" size={13} /></span>

      {/* plus marks */}
      <span style={{ position:'absolute', top:'40%', left:'9%', color:'#3B5BFF', opacity:0.45, fontSize:24, fontWeight:300 }}>+</span>
      <span style={{ position:'absolute', bottom:'34%', right:'28%', color:'#FB5E09', opacity:0.45, fontSize:22, fontWeight:300 }}>+</span>
      <span style={{ position:'absolute', top:'80%', right:'8%', color:'#2E7D46', opacity:0.4, fontSize:20, fontWeight:300 }}>+</span>
    </div>
  )
}

const FIELDS: Record<FormType, Field[]> = {
  login:        [{ name:'email',label:'Email',type:'email',placeholder:'you@example.com' },{ name:'password',label:'Password',type:'password',placeholder:'Your password' }],
  register:     [{ name:'name',label:'Full Name',type:'text',placeholder:'Jane Smith' },{ name:'email',label:'Email',type:'email',placeholder:'you@example.com' },{ name:'password',label:'Password',type:'password',placeholder:'Create a strong password' },{ name:'confirmPassword',label:'Confirm Password',type:'password',placeholder:'Repeat password' }],
  forgot:       [{ name:'email',label:'Email',type:'email',placeholder:'you@example.com' }],
  'verify-otp': [{ name:'code',label:'6-digit OTP',type:'text',placeholder:'000000' }],
  reset:        [{ name:'password',label:'New Password',type:'password',placeholder:'Create a strong password' },{ name:'confirmPassword',label:'Confirm Password',type:'password',placeholder:'Repeat new password' }],
}
const TITLES:    Record<FormType,string> = { login:'Welcome back', register:'Create your account', forgot:'Forgot password', 'verify-otp':'Enter your OTP', reset:'Set new password' }
const SUBTITLES: Record<FormType,string> = { login:'Log in to your Rankkw dashboard', register:'Start growing your Etsy shop with data', forgot:"We'll send a 6-digit code to your email", 'verify-otp':'Check your inbox for the code we sent', reset:'Choose a strong new password' }
const BUTTONS:   Record<FormType,string> = { login:'Log in →', register:'Create account →', forgot:'Send reset code →', 'verify-otp':'Verify code →', reset:'Reset password →' }
const ENDPOINTS: Record<FormType,string> = { login:'/api/auth/login', register:'/api/auth/register', forgot:'/api/auth/forgot-password', 'verify-otp':'/api/auth/verify-otp', reset:'/api/auth/reset-password' }

type EmailStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken'

function AuthFormInner({ type, email: initEmail, onNext, providers }: { type: FormType; email?: string; onNext?: (email: string) => void; providers?: { google?: boolean; microsoft?: boolean } }) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? '/dashboard'
  const oauthMsg     = OAUTH_ERRORS[searchParams.get('error') ?? ''] ?? ''
  const showOAuth    = (type === 'login' || type === 'register') && Boolean(providers?.google || providers?.microsoft)

  const [values,  setValues]  = useState<Record<string,string>>(initEmail ? { email: initEmail } : {})
  const [errors,  setErrors]  = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle')
  const [pwned, setPwned] = useState<number | null>(null) // null = unknown, 0 = safe, >0 = breach count
  const [reveal, setReveal] = useState<Record<string, boolean>>({}) // per-field show/hide password

  const isRegister  = type === 'register'
  // Reset uses the same new-password rules as signup, minus the live email check.
  const showPwRules = type === 'register' || type === 'reset'

  // Login & signup require a solved reCAPTCHA (only when keys are configured).
  const needsCaptcha = (type === 'login' || type === 'register') && RECAPTCHA_ENABLED

  const set = useCallback((k: string, v: string) => {
    setValues(p => ({ ...p, [k]: v }))
    setErrors(p => { const n = { ...p }; delete n[k]; return n })
  }, [])

  // ── Live password / confirm state (register + reset) ──
  const pw          = values.password ?? ''
  const pwChecks    = PASSWORD_RULES.map(r => ({ label: r.label, ok: r.test(pw) }))
  const pwValid     = pwChecks.every(c => c.ok)
  const confirm     = values.confirmPassword ?? ''
  const confirmOk   = confirm.length > 0 && confirm === pw
  const confirmBad  = confirm.length > 0 && confirm !== pw

  // ── Live "email already registered?" check (register only, debounced) ──
  useEffect(() => {
    if (!isRegister) return
    const email = (values.email ?? '').trim().toLowerCase()
    if (!email) { setEmailStatus('idle'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setEmailStatus('invalid'); return }

    setEmailStatus('checking')
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
        const json = await res.json()
        if (cancelled) return
        if (!json.valid) setEmailStatus('invalid')
        else setEmailStatus(json.exists ? 'taken' : 'available')
      } catch { if (!cancelled) setEmailStatus('idle') }
    }, 450)
    return () => { cancelled = true; clearTimeout(t) }
  }, [values.email, isRegister])

  // ── Live breached-password check (HIBP k-anonymity), only once the rules pass ──
  useEffect(() => {
    if (!showPwRules || !pwValid) { setPwned(null); return }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const hash = (await sha1Hex(pw)).toUpperCase()
        const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`)
        const text = await res.text()
        const suffix = hash.slice(5)
        let count = 0
        for (const line of text.split('\n')) {
          const [suf, c] = line.trim().split(':')
          if (suf === suffix) { count = parseInt(c ?? '0', 10) || 0; break }
        }
        if (!cancelled) setPwned(count)
      } catch { if (!cancelled) setPwned(null) } // fail open — server still checks
    }, 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [pw, pwValid, showPwRules])

  const isPwned = (pwned ?? 0) > 0

  // Block signup submission on client-known problems (server still re-validates).
  const registerBlocked = isRegister && (emailStatus === 'taken' || emailStatus === 'invalid' || !pwValid || !confirmOk || isPwned || (values.name ?? '').trim().length < 2)
  const resetBlocked    = type === 'reset' && (!pwValid || !confirmOk || isPwned)

  const submit = useCallback(async () => {
    setLoading(true); setErrors({}); setSuccess('')
    const body: Record<string,string> = { ...values }
    if (type === 'verify-otp' || type === 'reset') body.email = initEmail ?? ''
    if (type === 'verify-otp') body.type = 'reset'
    if (needsCaptcha) body.captchaToken = captcha
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
  }, [values, type, initEmail, router, redirect, onNext, needsCaptcha, captcha])

  const S = {
    wrap:  { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.canvas, padding:24, position:'relative', overflow:'hidden' } as const,
    card:  { background:C.paper, borderRadius:24, padding:'40px 40px 44px', width:'100%', maxWidth:440, border:`1px solid ${C.hairInk}`, position:'relative', zIndex:1, boxShadow:'0 24px 60px rgba(61,62,59,0.12)' } as const,
    label: { display:'block', fontSize:11, fontFamily:"'General Sans',monospace", fontWeight:500, textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'#6E6E64', marginBottom:8 } as const,
    input: { width:'100%', border:`1px solid ${C.hair}`, borderRadius:8, padding:'12px 14px', fontSize:14, fontFamily:'inherit', outline:'none', background:C.canvas, color:'#1a1a1a', transition:'border-color 0.15s', boxSizing:'border-box' } as const,
    btn:   { width:'100%', background: C.orange, color:'#fff', border:'none', borderRadius:28, padding:'14px', fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'inherit', marginTop:24, transition:'opacity 0.18s', letterSpacing:'-0.01em' } as const,
    link:  { color:C.ink, fontSize:13.5, textDecoration:'none', fontWeight:500 } as const,
  }

  // Per-field border colour: red on any error, green when the field is validly
  // filled (register/reset live checks), otherwise the neutral hairline.
  const borderColor = (name: string): string => {
    if (errors[name]) return RED
    if (name === 'email' && isRegister) {
      if (emailStatus === 'taken' || emailStatus === 'invalid') return RED
      if (emailStatus === 'available') return GREEN
    }
    if (name === 'password' && showPwRules && pw.length > 0) return (pwValid && !isPwned) ? GREEN : RED
    if (name === 'confirmPassword' && showPwRules) {
      if (confirmOk) return GREEN
      if (confirmBad) return RED
    }
    return C.hair
  }

  const emailMsg = (): { text: string; color: string } | null => {
    if (!isRegister || !(values.email ?? '').trim()) return null
    if (emailStatus === 'checking')   return { text: 'Checking availability…', color: '#888' }
    if (emailStatus === 'invalid')    return { text: 'Enter a valid email address', color: RED }
    if (emailStatus === 'taken')      return { text: 'That email is already registered', color: RED }
    if (emailStatus === 'available')  return { text: '✓ Email is available', color: GREEN }
    return null
  }
  const em = emailMsg()

  const btnDisabled = loading || (needsCaptcha && !captcha) || registerBlocked || resetBlocked

  return (
    <div style={S.wrap}>
      <AuthBackdrop />
      <div style={S.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:26 }}>
          <Link href="/" aria-label="Back to home"
            style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:13, fontWeight:500, color:C.graphite, textDecoration:'none', border:`1px solid ${C.hair}`, borderRadius:100, padding:'7px 13px 7px 10px', transition:'background 0.15s, border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bone; e.currentTarget.style.borderColor = C.ink }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.hair }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            Home
          </Link>
          <span style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:11, fontFamily:"'General Sans',monospace", fontWeight:500, textTransform:'uppercase', letterSpacing:'0.09em', color:'#6E6E64' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:C.orange, display:'inline-block' }} />
            Rankkw
          </span>
        </div>
        <h1 style={{ fontSize:32, fontWeight:500, color:C.ink, letterSpacing:'-0.03em', marginBottom:8, lineHeight:1.05 }}>{TITLES[type]}</h1>
        <p style={{ fontSize:15, color:'#6E6E64', marginBottom:30, lineHeight:1.5, letterSpacing:'-0.1px' }}>{SUBTITLES[type]}</p>

        {success  && <div style={{ background:C.orange, color:C.snow, borderRadius:10, padding:'12px 16px', fontSize:13.5, marginBottom:16 }}>✓ {success}</div>}
        {(errors._ || oauthMsg) && <div style={{ background:'#fff0f0', color:'#c00', borderRadius:10, padding:'12px 16px', fontSize:13.5, marginBottom:16 }}>⚠ {errors._ || oauthMsg}</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {FIELDS[type].map(field => {
            const isPw  = field.type === 'password'
            const shown = !!reveal[field.name]
            return (
            <div key={field.name}>
              <label style={S.label}>{field.label}</label>
              <div style={{ position:'relative' }}>
                <input type={isPw ? (shown ? 'text' : 'password') : field.type} placeholder={field.placeholder} value={values[field.name]??''}
                  onChange={e => set(field.name, e.target.value)} onKeyDown={e => e.key==='Enter'&&!btnDisabled&&submit()}
                  autoComplete={field.name==='password'?(isRegister?'new-password':'current-password'):field.name==='confirmPassword'?'new-password':field.name==='email'?'email':undefined}
                  style={{ ...S.input, borderColor: borderColor(field.name), ...(isPw ? { paddingRight:44 } : {}) }}
                  maxLength={field.name==='code'?6:200} />
                {isPw && (
                  <button type="button" tabIndex={-1} aria-label={shown ? 'Hide password' : 'Show password'}
                    onClick={() => setReveal(p => ({ ...p, [field.name]: !p[field.name] }))}
                    style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', cursor:'pointer', color:'#8a8a80', padding:8, display:'grid', placeItems:'center', lineHeight:0 }}>
                    <EyeIcon off={shown} />
                  </button>
                )}
              </div>

              {/* Field-level messages */}
              {errors[field.name] && <p style={{ fontSize:12, color:RED, marginTop:5 }}>{errors[field.name]}</p>}
              {field.name==='email' && em && <p style={{ fontSize:12, color:em.color, marginTop:5 }}>{em.text}</p>}

              {/* Live password-rules checklist */}
              {field.name==='password' && showPwRules && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px', marginTop:8 }}>
                  {pwChecks.map(c => (
                    <span key={c.label} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11.5, color: c.ok ? GREEN : '#999' }}>
                      <span style={{ display:'inline-flex', width:13, height:13, borderRadius:'50%', background: c.ok ? GREEN : '#d9d9d2', color:'#fff', alignItems:'center', justifyContent:'center', fontSize:9, flexShrink:0 }}>
                        {c.ok ? '✓' : ''}
                      </span>
                      {c.label}
                    </span>
                  ))}
                </div>
              )}
              {field.name==='password' && showPwRules && isPwned && (
                <p style={{ fontSize:12, color:RED, marginTop:6 }}>⚠ This password appeared in {pwned!.toLocaleString()} known data breaches — please choose another.</p>
              )}
              {field.name==='confirmPassword' && confirmBad && <p style={{ fontSize:12, color:RED, marginTop:5 }}>Passwords don&apos;t match</p>}
              {field.name==='confirmPassword' && confirmOk  && <p style={{ fontSize:12, color:GREEN, marginTop:5 }}>✓ Passwords match</p>}
            </div>
          )})}
        </div>

        {needsCaptcha && (
          <div style={{ marginTop:20 }}>
            <Recaptcha onVerify={setCaptcha} onExpire={() => setCaptcha('')} />
          </div>
        )}

        <button style={{ ...S.btn, opacity: btnDisabled?0.6:1, cursor: btnDisabled?'not-allowed':'pointer' }} onClick={submit} disabled={btnDisabled}>
          {loading ? 'Please wait...' : BUTTONS[type]}
        </button>

        {showOAuth && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, margin:'22px 0 16px' }}>
              <span style={{ flex:1, height:1, background:C.hair }} />
              <span style={{ fontSize:12, color:'#999' }}>or continue with</span>
              <span style={{ flex:1, height:1, background:C.hair }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {providers?.google    && <OAuthButton provider="google"    label="Continue with Google"    redirect={redirect} />}
              {providers?.microsoft && <OAuthButton provider="microsoft" label="Continue with Microsoft" redirect={redirect} />}
            </div>
          </>
        )}

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

export interface AuthFormProps { type: FormType; email?: string; onNext?: (email: string) => void; providers?: { google?: boolean; microsoft?: boolean } }

export function AuthForm(props: AuthFormProps) {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.canvas }}><div className="shimmer" style={{ width:440, height:520, borderRadius:24, background:'#e8e7e2' }} /></div>}>
      <AuthFormInner {...props} />
    </Suspense>
  )
}
