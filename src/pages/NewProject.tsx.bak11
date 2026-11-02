import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type C = { id: string; name: string; faculty: string | null }

export default function NewProject() {
  const nav = useNavigate()
  const [step, setStep] = useState(0), [courses, setCourses] = useState<C[]>([]), [q, setQ] = useState('')
  const [f, setF] = useState({ course: null as C | null, institution: 'Kaduna State University (KASU)', topic: '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)

  useEffect(() => { supabase.from('course_profiles').select('id,name,faculty').order('faculty').order('name').then(({ data }) => setCourses((data as C[]) ?? [])) }, [])

  const ok = [!!f.course, !!f.institution.trim(), f.topic.trim().length > 5][step]
  const shown = courses.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
  const groups = [...new Set(shown.map(c => c.faculty ?? 'Other'))]
  const titles = ['Your course', 'Your institution', 'Your project topic']

  async function create() {
    setBusy(true); setErr('')
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('projects').insert({ user_id: u.user!.id, course_id: f.course!.id, course_name: f.course!.name, level: '400 Level', institution: f.institution.trim(), topic: f.topic.trim(), project_type: 'Final Year Project', status: 'ready' }).select('id').single()
    setBusy(false)
    if (error) return setErr(error.message)
    nav(`/projects/${data.id}/generate`)
  }

  return (
    <main className="mx-auto max-w-2xl p-5">
      <p className="text-sm text-ink/60">Step {step + 1} of 3 · 400 Level Final Year Project</p>
      <h1 className="font-display mt-1 text-3xl font-semibold">{titles[step]}</h1>
      <div className="mt-6">
        {step === 0 && <>
          <input className="input mb-4" placeholder="Search your course" value={q} onChange={e => setQ(e.target.value)} />
          {groups.map(g => (
            <div key={g} className="mb-5">
              <p className="mb-2 text-sm font-semibold text-ink/60">{g}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {shown.filter(c => (c.faculty ?? 'Other') === g).map(c => (
                  <button key={c.id} onClick={() => setF({ ...f, course: c })} className={`rounded-xl border p-3 text-left ${f.course?.id === c.id ? 'border-gold bg-gold/10' : 'border-line bg-white'}`}>{c.name}</button>
                ))}
              </div>
            </div>))}
          {shown.length === 0 && <p className="text-sm text-ink/60">No course found. Try a different word.</p>}
        </>}
        {step === 1 && <input className="input" value={f.institution} onChange={e => setF({ ...f, institution: e.target.value })} />}
        {step === 2 && <textarea className="input" rows={4} placeholder="e.g. Determination of the Phytochemical Constituents and Antioxidant Properties of the Ethanolic Leaf Extract of Momordica charantia" value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })} />}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-700">{err}</p>}
      <div className="mt-8 flex justify-between">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < 2 ? <button className="btn-primary" disabled={!ok} onClick={() => setStep(step + 1)}>Next</button> : <button className="btn-gold" disabled={!ok || busy} onClick={create}>{busy ? 'Creating…' : 'Create project'}</button>}
      </div>
    </main>)
}
