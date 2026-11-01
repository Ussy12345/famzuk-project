import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import './index.css'
import { supabase } from './lib/supabase'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import { Overview, Interview, Generate, Editor, Sources, Settings } from './pages/ProjectPages'
import { Profile, Admin } from './pages/Account'

function Guard({ s, children }: { s: Session | null | undefined; children: React.ReactNode }) {
  if (s === undefined) return <p className="p-8">Loading…</p>
  return s ? <>{children}</> : <Navigate to="/login" />
}
function App() {
  const [s, setS] = React.useState<Session | null | undefined>(undefined)
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setS(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, x) => setS(x))
    return () => data.subscription.unsubscribe()
  }, [])
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route path="/forgot-password" element={<Auth mode="forgot" />} />
      <Route path="/dashboard" element={<Guard s={s}><Dashboard /></Guard>} />
      <Route path="/projects/new" element={<Guard s={s}><NewProject /></Guard>} />
      <Route path="/projects/:id" element={<Guard s={s}><Overview /></Guard>} />
      <Route path="/projects/:id/interview" element={<Guard s={s}><Interview /></Guard>} />
      <Route path="/projects/:id/generate" element={<Guard s={s}><Generate /></Guard>} />
      <Route path="/projects/:id/editor" element={<Guard s={s}><Editor /></Guard>} />
      <Route path="/projects/:id/sources" element={<Guard s={s}><Sources /></Guard>} />
      <Route path="/projects/:id/settings" element={<Guard s={s}><Settings /></Guard>} />
      <Route path="/profile" element={<Guard s={s}><Profile /></Guard>} />
      <Route path="/admin" element={<Guard s={s}><Admin /></Guard>} />
      <Route path="*" element={<p className="p-8">Page not found. <Link className="underline" to="/">Go home</Link></p>} />
    </Routes>
  )
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>)
