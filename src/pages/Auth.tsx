import { useState, FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span>{children}</label>
}

export default function Auth({ mode }: { mode: 'login' | 'register' | 'forgot' }) {
  const nav = useNavigate()
  const [first, setFirst] = useState(''), [last, setLast] = useState('')
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(''), [good, setGood] = useState(false), [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(''); setGood(false)
    if (mode === 'register' && password !== confirm) return setMsg('Passwords do not match.')
    setBusy(true)
    let error: { message: string } | null = null
    if (mode === 'login') ({ error } = await supabase.auth.signInWithPassword({ email, password }))
    else if (mode === 'register') ({ error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: `${first} ${last}`.trim() } } }))
    else { ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/login' })); if (!error) { setGood(true); setMsg('Check your email for a reset link.') } }
    setBusy(false)
    if (error) return setMsg(error.message)
    if (mode !== 'forgot') nav('/dashboard')
  }

  const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create account' : 'Reset password'
  const sub = mode === 'login' ? 'Sign in to continue your project.' : mode === 'register' ? 'Join thousands of students using Famzuk.' : 'We will email you a link to set a new password.'
  const tab = (active: boolean) => `rounded-xl py-2.5 text-center text-sm font-semibold transition ${active ? 'bg-white text-brand shadow' : 'text-ink/50 hover:text-ink'}`

  return (
    <div className="min-h-screen bg-cream">
      <div className="h-1.5 bg-gradient-to-r from-[#7e6141] to-gold" />
      <main className="mx-auto max-w-[460px] px-5 pb-10 pt-12">
        {mode !== 'forgot' && (
          <div className="mb-8 grid grid-cols-2 gap-1 rounded-2xl bg-tab p-1.5 shadow-md">
            <Link to="/login" className={tab(mode === 'login')}>Log In</Link>
            <Link to="/register" className={tab(mode === 'register')}>Sign Up</Link>
          </div>)}
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mb-6 mt-2 text-sm text-ink/60">{sub}</p>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name"><input className="input" placeholder="John" value={first} onChange={e => setFirst(e.target.value)} required /></Field>
              <Field label="Last Name"><input className="input" placeholder="Doe" value={last} onChange={e => setLast(e.target.value)} required /></Field>
            </div>)}
          <Field label="Email Address"><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></Field>
          {mode !== 'forgot' && <Field label="Password"><input className="input" type="password" minLength={6} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required /></Field>}
          {mode === 'register' && <Field label="Confirm Password"><input className="input" type="password" minLength={6} placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></Field>}
          {msg && <p role="alert" className={`text-sm ${good ? 'text-green-700' : 'text-red-700'}`}>{msg}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log In' : mode === 'register' ? 'Create Account' : 'Send reset link'}</button>
        </form>
        <p className="mt-5 text-center text-sm text-ink/60">
          {mode === 'login' && <Link className="underline" to="/forgot-password">Forgot password?</Link>}
          {mode === 'forgot' && <Link className="underline" to="/login">Back to log in</Link>}
        </p>
      </main>
    </div>)
}
