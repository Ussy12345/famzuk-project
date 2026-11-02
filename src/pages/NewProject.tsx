import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type I = { id: string; name: string; short_name: string; final_level: string }
type C = { id: string; name: string; faculty: string | null }

export default function NewProject() {
  const nav = useNavigate()
  const [step, setStep] = useState(0), [insts, setInsts] = useState<I[]>([]), [courses, setCourses] = useState<C[]>([]), [q, setQ] = useState('')
  const [inst, setInst] = useState<I | null>(null), [course, setCourse] = useState<C | null>(null), [topic, setTopic] = useState('')
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)

  useEffect(() => { supabase.from('institutions').select('*').order('name').then(({ data }) => setInsts((data as I[]) ?? [])) }, [])

  async function pickInstitution(i: I) {
    setInst(i); setCourse(null); setQ(''); setCourses([])
    const { data } = await supabase.from('course_profiles').select('id,name,faculty').eq('institution_id', i.id).order('faculty').order('name')
    setCourses((data as C[]) ?? []); setStep(1)
  }

  const ok = [!!inst, !!course, topic.trim().length > 5][step]
  const shown = courses.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
  const groups = [...new Set(shown.map(c => c.faculty ?? 'Other'))]
  const titles = ['Which institution are you in?', 'Your course', 'Your project topic']

  async function create() {
    setBusy(true); setErr('')
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('projects').insert({ user_id: u.user!.id, course_id: course!.id, course_name: course!.name, level: inst!.final_level, institution: inst!.name, topic: topic.trim(), project_type: 'Final Year Project', status: 'ready' }).select('id').single()
    setBusy(false)
    if (error) return setErr(error.message)
    nav(`/projects/${data.id}/generate`)
  }

  return (
    <main className="mx-auto max-w-2xl p-5">
      <p className="text-sm text-ink/60">Step {step + 1} of 3{inst ? ` · ${inst.short_name} · ${inst.final_level}` : ''}</p>
      <h1 className="font-display mt-1 text-3xl font-semibold">{titles[step]}</h1>
      <div className="mt-6">
        {step === 0 && <div className="grid gap-3">{insts.map(i => (
          <button key={i.id} onClick={() => pickInstitution(i)} className={`rounded-xl border p-4 text-left ${inst?.id === i.id ? 'border-gold bg-gold/10' : 'border-line bg-white'}`}>
            <span className="font-semibold">{i.name}</span><span className="block text-sm text-ink/60">Final year: {i.final_level}</span></button>))}</div>}
        {step === 1 && <>
          <input className="input mb-4" placeholder="Search your course" value={q} onChange={e => setQ(e.target.value)} />
          {groups.map(g => (
            <div key={g} className="mb-5">
              <p className="mb-2 text-sm font-semibold text-ink/60">{g}</p>
              <div className="grid gap-2 sm:grid-cols-2">{shown.filter(c => (c.faculty ?? 'Other') === g).map(c => (
                <button key={c.id} onClick={() => setCourse(c)} className={`rounded-xl border p-3 text-left ${course?.id === c.id ? 'border-gold bg-gold/10' : 'border-line bg-white'}`}>{c.name}</button>))}</div>
            </div>))}
          {shown.length === 0 && <p className="text-sm text-ink/60">No course found. Try a different word.</p>}
        </>}
        {step === 2 && <textarea className="input" rows={4} placeholder="Type your final year project topic" value={topic} onChange={e => setTopic(e.target.value)} />}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-700">{err}</p>}
      <div className="mt-8 flex justify-between">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step === 0 ? <span /> : step < 2 ? <button className="btn-primary" disabled={!ok} onClick={() => setStep(step + 1)}>Next</button> : <button className="btn-gold" disabled={!ok || busy} onClick={create}>{busy ? 'Creating…' : 'Create project'}</button>}
      </div>
    </main>)
}
