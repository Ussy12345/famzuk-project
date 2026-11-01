import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
type C = { id: string; name: string }
const levels = ['300 Level', '400 Level', "Master's", 'Other']
const types = ['Research Project', 'Final Year Project', 'System Development Project', 'Dissertation', 'Other']
export default function NewProject() {
  const nav = useNavigate()
  const [step, setStep] = useState(0), [courses, setCourses] = useState<C[]>([]), [q, setQ] = useState('')
  const [f, setF] = useState({ course: null as C | null, level: '', institution: '', topic: '', type: '' })
  const [err, setErr] = useState('')
  useEffect(() => { supabase.from('course_profiles').select('id,name').order('name').then(({ data }) => setCourses((data as C[]) ?? [])) }, [])
  const ok = [!!f.course, !!f.level, !!f.institution.trim(), f.topic.trim().length > 5, !!f.type][step]
  async function create() {
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('projects').insert({ user_id: u.user!.id, course_id: f.course!.id, course_name: f.course!.name, level: f.level, institution: f.institution, topic: f.topic, project_type: f.type, status: 'interview' }).select('id').single()
    if (error) return setErr(error.message)
    nav(`/projects/${data.id}/interview`)
  }
  const pick = (opts: string[], cur: string, set: (v: string) => void) => (
    <div className="grid gap-2 sm:grid-cols-2">{opts.map(o => <button key={o} onClick={() => set(o)} className={`rounded-lg border p-3 text-left ${cur === o ? 'border-brand bg-brand/10' : 'border-ink/20 bg-white'}`}>{o}</button>)}</div>)
  const titles = ['Course or department', 'Level', 'Institution', 'Project topic', 'Project type']
  return (
    <main className="mx-auto max-w-2xl p-5">
      <p className="text-sm text-ink/60">Step {step + 1} of 5</p>
      <h1 className="font-display mt-1 text-3xl font-semibold">{titles[step]}</h1>
      <div className="mt-6">
        {step === 0 && <><input className="input mb-3" placeholder="Search courses" value={q} onChange={e => setQ(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">{courses.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).map(c => <button key={c.id} onClick={() => setF({ ...f, course: c })} className={`rounded-lg border p-3 text-left ${f.course?.id === c.id ? 'border-brand bg-brand/10' : 'border-ink/20 bg-white'}`}>{c.name}</button>)}</div></>}
        {step === 1 && pick(levels, f.level, v => setF({ ...f, level: v }))}
        {step === 2 && <input className="input" placeholder="e.g. University of Abuja" value={f.institution} onChange={e => setF({ ...f, institution: e.target.value })} />}
        {step === 3 && <textarea className="input" rows={3} placeholder="e.g. Development of an Online CBT Examination System" value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })} />}
        {step === 4 && pick(types, f.type, v => setF({ ...f, type: v }))}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-700">{err}</p>}
      <div className="mt-8 flex justify-between">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < 4 ? <button className="btn-primary" disabled={!ok} onClick={() => setStep(step + 1)}>Next</button> : <button className="btn-primary" disabled={!ok} onClick={create}>Create project</button>}
      </div>
    </main>)
}
