import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
type P = { id: string; topic: string; course_name: string; level: string; status: string; updated_at: string }
export default function Dashboard() {
  const nav = useNavigate()
  const [ps, setPs] = useState<P[]>([]), [name, setName] = useState('')
  const load = () => supabase.from('projects').select('*').order('updated_at', { ascending: false }).then(({ data }) => setPs((data as P[]) ?? []))
  useEffect(() => { load(); supabase.auth.getUser().then(({ data }) => setName(data.user?.user_metadata?.full_name ?? '')) }, [])
  async function del(id: string) { if (confirm('Delete this project and all its content?')) { await supabase.from('projects').delete().eq('id', id); load() } }
  return (
    <main className="mx-auto max-w-5xl p-5">
      <div className="flex items-center justify-between"><h1 className="font-display text-3xl font-semibold">Welcome back{name && `, ${name}`}</h1>
        <button className="btn-ghost" onClick={async () => { await supabase.auth.signOut(); nav('/') }}>Log out</button></div>
      <div className="mt-6 flex items-center justify-between"><h2 className="text-xl font-semibold">Projects</h2><Link to="/projects/new" className="btn-primary">Create new project</Link></div>
      {ps.length === 0 && <p className="mt-8 text-ink/60">No projects yet. Create your first one to get started.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {ps.map(p => (
          <article key={p.id} className="rounded-xl border border-ink/10 bg-white p-5">
            <h3 className="font-semibold">{p.topic}</h3>
            <p className="mt-1 text-sm text-ink/60">{p.course_name} — {p.level}</p>
            <p className="mt-1 text-sm">Status: <b>{p.status}</b> · Updated {new Date(p.updated_at).toLocaleDateString()}</p>
            <div className="mt-4 flex gap-2"><Link className="btn-primary !py-1.5" to={`/projects/${p.id}`}>Open</Link><button className="btn-ghost !py-1.5" onClick={() => del(p.id)}>Delete</button></div>
          </article>))}
      </div>
    </main>)
}
