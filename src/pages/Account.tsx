import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
type Row = Record<string, any>
export function Profile() {
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [msg, setMsg] = useState('')
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { setEmail(data.user?.email ?? ''); setName(data.user?.user_metadata?.full_name ?? '') }) }, [])
  return <main className="mx-auto max-w-md p-5"><Link to="/dashboard" className="text-sm underline">← Dashboard</Link><h1 className="font-display mt-3 text-3xl font-semibold">Profile</h1><p className="mt-2 text-ink/60">{email}</p>
    <input className="input mt-4" value={name} onChange={e => setName(e.target.value)} /><button className="btn-primary mt-3" onClick={async () => { await supabase.auth.updateUser({ data: { full_name: name } }); const { data } = await supabase.auth.getUser(); await supabase.from('profiles').update({ full_name: name }).eq('id', data.user!.id); setMsg('Saved') }}>Save</button> <span className="text-sm">{msg}</span></main>
}
export function Admin() {
  const [ok, setOk] = useState<boolean | null>(null), [cs, setCs] = useState<Row[]>([]), [n, setN] = useState(''), [insts, setInsts] = useState<Row[]>([]), [inst, setInst] = useState('')
  const load = () => supabase.from('course_profiles').select('*').order('name').then(({ data }) => setCs(data ?? []))
  useEffect(() => { load(); supabase.from('institutions').select('*').order('name').then(({ data }) => { setInsts(data ?? []); setInst(data?.[0]?.id ?? '') }); supabase.auth.getUser().then(async ({ data }) => { const r = await supabase.from('profiles').select('is_admin').eq('id', data.user!.id).single(); setOk(!!r.data?.is_admin) }) }, [])
  if (ok === null) return <p className="p-8">Loading…</p>; if (!ok) return <p className="p-8">Admins only.</p>
  return <main className="mx-auto max-w-2xl p-5"><Link to="/dashboard" className="text-sm underline">← Dashboard</Link><h1 className="font-display mt-3 text-3xl font-semibold">Course management</h1>
    <div className="mt-4 flex gap-2"><select className="input !w-auto" value={inst} onChange={e => setInst(e.target.value)}>{insts.map(i => <option key={i.id} value={i.id}>{i.short_name}</option>)}</select><input className="input" placeholder="New course name" value={n} onChange={e => setN(e.target.value)} /><button className="btn-primary" disabled={!n.trim()} onClick={async () => { await supabase.from('course_profiles').insert({ name: n, institution_id: inst, project_types: ['Final Year Project'] }); setN(''); load() }}>Add course</button></div>
    <ul className="mt-4 space-y-2">{cs.map(c => <li key={c.id} className="flex justify-between rounded-lg border border-ink/10 bg-white p-3"><span>{c.name} <span className="text-xs text-ink/50">({insts.find(i => i.id === c.institution_id)?.short_name})</span></span><button className="underline" onClick={async () => { if (confirm(`Delete ${c.name}?`)) { await supabase.from('course_profiles').delete().eq('id', c.id); load() } }}>Delete</button></li>)}</ul></main>
}
