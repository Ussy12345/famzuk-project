import { useEffect, useRef, useState, ReactNode } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { supabase, callAI } from '../lib/supabase'
import { buildTemplate } from '../lib/templates'
import { clean } from '../lib/clean'
import { exportPdf, exportDocx, exportSectionPdf, exportSectionDocx, exportChapterPdf, exportChapterDocx } from '../lib/export'
import { readDocxMarks } from '../lib/docxMarks'
type Row = Record<string, any>
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function useTimed(active: boolean, expected: number) {
  const [t, setT] = useState(0)
  useEffect(() => { if (!active) { setT(0); return } const t0 = Date.now(); const i = setInterval(() => setT((Date.now() - t0) / 1000), 500); return () => clearInterval(i) }, [active])
  return { pct: active ? Math.min(95, Math.round((t / expected) * 100)) : 0, left: Math.max(5, Math.round(expected - t)), over: t > expected }
}
function Ring({ pct, label, sub }: { pct: number; label?: string; sub?: string }) {
  const r = 34, c = 2 * Math.PI * r
  return <div className="flex items-center gap-4" role="progressbar" aria-valuenow={pct}>
    <div className="relative h-[84px] w-[84px] shrink-0"><svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90"><circle cx="42" cy="42" r={r} fill="none" stroke="#d6d1c8" strokeWidth="8" /><circle cx="42" cy="42" r={r} fill="none" stroke="#c8893a" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-all duration-500" /></svg><span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{pct}%</span></div>
    <div><p className="font-medium">{label}</p>{sub && <p className="text-sm text-ink/60">{sub}</p>}</div></div>
}
const NUM = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN']
const PRELIM = ['Title Page', 'Certification', 'Approval Page', 'Dedication', 'Acknowledgments', 'Abstract', 'Table of Contents', 'List of Tables', 'List of Figures']
async function toJpeg(file: File): Promise<{ data: string; mime: string }> {
  const bmp = await createImageBitmap(file); const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return { data: c.toDataURL('image/jpeg', 0.82).split(',')[1], mime: 'image/jpeg' }
}
export function useProject() {
  const { id } = useParams(); const [p, setP] = useState<Row | null>(null)
  const reload = () => supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => setP(data))
  useEffect(() => { reload() }, [id]); return { id: id!, p, reload }
}
export function Shell({ id, p, children, extra, wide }: { id: string; p: Row | null; children: ReactNode; extra?: (done: () => void) => ReactNode; wide?: boolean }) {
  const nav = useNavigate(); const [open, setOpen] = useState(false)
  const links = [['', 'Overview'], ['generate', 'Generate'], ['survey', 'Survey'], ['editor', 'Editor'], ['sources', 'Sources'], ['settings', 'Settings']]
  const done = () => setOpen(false)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', k); const o = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = o }
  }, [open])
  const side = (
    <div className="flex h-full min-h-0 flex-col">
      <Link to="/dashboard" onClick={done} className="text-sm text-ink/60 hover:underline">← All projects</Link>
      <p className="font-display mb-4 mt-3 line-clamp-3 font-semibold leading-snug">{p?.topic}</p>
      <nav className="flex flex-col gap-1">{links.map(([t, n]) => (
        <NavLink key={t} end to={`/projects/${id}/${t}`} onClick={done} className={({ isActive }) => `rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-brand text-white' : 'hover:bg-tab'}`}>{n}</NavLink>))}</nav>
      {extra && <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-t border-line pt-3">{extra(done)}</div>}
      <div className="mt-auto flex gap-4 border-t border-line pt-3 text-sm">
        <Link to="/profile" onClick={done} className="text-ink/70 hover:underline">Profile</Link>
        <button className="text-ink/70 hover:underline" onClick={async () => { await supabase.auth.signOut(); nav('/') }}>Log out</button>
      </div>
    </div>)
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden border-r border-line bg-white p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col">{side}</aside>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
        <button className="btn-primary !px-3 !py-1.5 text-sm" aria-label="Open menu" onClick={() => setOpen(true)}>☰ Menu</button>
        <span className="font-display min-w-0 truncate text-sm font-semibold">{p?.topic}</span>
      </header>
      {open && <div className="fixed inset-0 z-50 lg:hidden">
        <div className="absolute inset-0 bg-ink/50" onClick={done} />
        <div role="dialog" aria-modal="true" aria-label="Project menu" className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white p-4 shadow-xl">{side}</div>
      </div>}
      <main className="min-w-0 flex-1 p-4 sm:p-6"><div className={wide ? '' : 'mx-auto max-w-3xl'}>{children}</div></main>
    </div>)
}

export function Overview() {
  const { id, p } = useProject(); const [mem, setMem] = useState<Row>({})
  useEffect(() => { supabase.from('project_memory').select('data').eq('project_id', id).maybeSingle().then(({ data }) => setMem(data?.data ?? {})) }, [id])
  const arr = (v: any) => (Array.isArray(v) ? v : v ? [v] : [])
  const rows: [string, any][] = [['Course', p?.course_name], ['Level', p?.level], ['Institution', p?.institution], ['Topic', p?.topic], ['Project type', p?.project_type], ['Problem', mem.problem], ['Aim', mem.aim], ['Target users', mem.targetUsers], ['Proposed solution', mem.proposedSolution], ['Methodology', mem.methodology], ['Main features', arr(mem.features)], ['Objectives', arr(mem.objectives)], ['Assumptions', arr(mem.assumptions)]]
  return <Shell id={id} p={p}><h1 className="font-display text-2xl font-semibold">Project memory</h1><p className="mb-4 text-sm text-ink/60">This is what the AI uses to write your project. Status: <b>{p?.status}</b></p>
    <dl className="space-y-3 rounded-xl border border-ink/10 bg-white p-5">{rows.filter(r => r[1] && (!Array.isArray(r[1]) || r[1].length)).map(([k, v]) => <div key={k}><dt className="text-sm font-semibold">{k}</dt><dd className="text-ink/80">{Array.isArray(v) ? <ul className="list-disc pl-5">{v.map((x: string) => <li key={x}>{x}</li>)}</ul> : v}</dd></div>)}</dl></Shell>
}

export function Interview() {
  const { id, p } = useProject(); const nav = useNavigate(); const [qs, setQs] = useState<Row[]>([]); const [a, setA] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const load = async () => { const { data } = await supabase.from('project_questions').select('*').eq('project_id', id).order('position'); setQs(data ?? []); return data ?? [] }
  async function next() { setBusy(true); setErr(''); const r = await callAI({ action: 'interview', projectId: id }); if (r.error) setErr(r.error); else if (r.done) return nav(`/projects/${id}/generate`); await load(); setBusy(false) }
  useEffect(() => { load().then(d => { if (!d.length) next() }) }, [id])
  const cur = qs.find(q => !q.answer)
  async function submit() { await supabase.from('project_questions').update({ answer: a }).eq('id', cur!.id); setA(''); await load(); await next() }
  return <Shell id={id} p={p}><h1 className="font-display text-2xl font-semibold">A few questions about your project</h1>
    <div className="mt-4 space-y-4">{qs.filter(q => q.answer).map(q => <div key={q.id}><p className="font-medium">{q.question}</p><p className="text-ink/70">{q.answer}</p></div>)}
      {cur && <div><p className="font-medium">{cur.question}</p><textarea className="input mt-2" rows={3} value={a} onChange={e => setA(e.target.value)} /><button className="btn-primary mt-2" disabled={!a.trim() || busy} onClick={submit}>{busy ? 'Thinking…' : 'Answer'}</button></div>}
      {busy && !cur && <p>Preparing your next question…</p>}{err && <p role="alert" className="text-red-700">{err} <button className="underline" onClick={next}>Try again</button></p>}</div></Shell>
}

const CHW = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN']
const PRE = ['Title Page', 'Certification', 'Approval Page', 'Dedication', 'Acknowledgments', 'Abstract', 'Table of Contents', 'List of Tables', 'List of Figures']

export function Generate() {
  const { id, p, reload } = useProject()
  const [pages, setPages] = useState(40), [secs, setSecs] = useState<Row[]>([]), [chs, setChs] = useState<Row[]>([])
  const [act, setAct] = useState(''), [runId, setRunId] = useState(''), [planning, setPlanning] = useState(false), [refBusy, setRefBusy] = useState(false)
  const [err, setErr] = useState(''), [note, setNote] = useState(''), [searched, setSearched] = useState<boolean | null>(null), [eta, setEta] = useState(0)
  const [fix, setFix] = useState<Row | null>(null), [corr, setCorr] = useState(''), [prop, setProp] = useState<Row[] | null>(null), [cbusy, setCbusy] = useState(false), [ferr, setFerr] = useState('')
  const stop = useRef(false); const tp = useTimed(planning, 90); const tr = useTimed(refBusy, 75)
  const [up, setUp] = useState<null | { c: Row; phase: 'pick' | 'busy' | 'review'; msg: string; items: Row[]; skipped: string[] }>(null)
  const load = async () => {
    const [a, b] = await Promise.all([supabase.from('project_chapters').select('*').eq('project_id', id).order('position'), supabase.from('project_sections').select('*').eq('project_id', id).order('position')])
    setChs(a.data ?? []); setSecs(b.data ?? []); return (b.data ?? []) as Row[]
  }
  useEffect(() => { load() }, [id]); useEffect(() => { if (p?.target_pages) setPages(p.target_pages) }, [p?.target_pages])

  async function plan() {
    setPlanning(true); setErr(''); await supabase.from('projects').update({ target_pages: pages }).eq('id', id)
    const r = await callAI({ action: 'plan', projectId: id }); if (r.error) setErr(r.error); else setSearched(!!r.searched)
    await load(); setPlanning(false); reload()
  }
  async function remove(sid: string) { await supabase.from('project_sections').delete().eq('id', sid); load() }

  async function writeChapter(c: Row, rewrite = false) {
    if (runId) return
    const idx = chs.findIndex(x => x.id === c.id); const W = CHW[idx] ?? String(idx + 1)
    setErr(''); stop.current = false; setRunId(c.id)
    setNote(`I will start writing Chapter ${W} (${c.title}) for you now. I write one chapter at a time so that each one stays accurate. When it is ready you can read it, ask for corrections and download it before we move on.`)
    await supabase.from('projects').update({ status: 'generating' }).eq('id', id)
    if (rewrite) await supabase.from('project_sections').update({ status: 'pending' }).eq('chapter_id', c.id)
    const have = await supabase.from('project_sources').select('id', { count: 'exact', head: true }).eq('project_id', id)
    if (!have.count) { setRefBusy(true); setAct('Finding and checking real references…'); await callAI({ action: 'find_references', projectId: id }); setRefBusy(false) }
    const gaveUp = new Set<string>(); const tries: Record<string, number> = {}; const t0 = Date.now(); let n0 = 0
    for (;;) {
      const mine = (await load()).filter(x => x.chapter_id === c.id)
      const s = mine.find(x => x.status !== 'completed' && !gaveUp.has(x.id)); if (!s || stop.current) break
      setAct(`Writing ${s.heading}…`); tries[s.id] = (tries[s.id] ?? 0) + 1
      await supabase.from('project_generation_jobs').update({ status: 'running', attempts: tries[s.id], started_at: new Date().toISOString() }).eq('section_id', s.id)
      const r = await callAI({ action: 'generate_section', projectId: id, sectionId: s.id })
      if (r.auth || /out of quota/i.test(r.error ?? '')) { stop.current = true; setErr(r.error) }
      if (r.ok) { n0++; setEta(Math.round(((Date.now() - t0) / 1000 / n0) * (mine.filter(x => x.status !== 'completed').length - 1))); await supabase.from('project_generation_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('section_id', s.id) }
      else { await supabase.from('project_generation_jobs').update({ status: 'failed', error: r.error }).eq('section_id', s.id); if (tries[s.id] >= 3) gaveUp.add(s.id); setAct(r.error ?? 'Retrying…'); await sleep(/Rate|internet|Network|unexpected/i.test(r.error ?? '') ? 30000 : 3000) }
      await sleep(1500)
    }
    const fin = await load(); const mine = fin.filter(x => x.chapter_id === c.id); const ready = mine.length > 0 && mine.every(x => x.status === 'completed')
    await supabase.from('projects').update({ status: fin.every(x => x.status === 'completed') ? 'review' : ready ? 'ready' : 'failed' }).eq('id', id)
    const nx = chs[idx + 1]
    setNote(ready ? `Chapter ${W} is ready. Please read it in the Editor. If your lecturer marked corrections, use "Correct this chapter". When you are happy with it, ${nx ? `we can continue to Chapter ${CHW[idx + 1] ?? idx + 2}.` : 'your project is complete. You can download it from Settings.'}` : stop.current ? `I paused Chapter ${W}. Press Continue when you are ready.` : `Some sections of Chapter ${W} could not be written. Press Continue to try them again.`)
    setRunId(''); setAct(''); reload()
  }

  const closeFix = () => { setFix(null); setProp(null); setCorr(''); setFerr('') }
  async function checkFix() {
    if (!fix || !corr.trim()) return; setCbusy(true); setFerr('')
    const r = await callAI({ action: 'correct_chapter', projectId: id, chapterId: fix.id, instruction: corr }); setCbusy(false)
    if (r.ok) setProp(r.changes ?? []); else setFerr(r.error ?? 'Could not apply the correction. Please try again.')
  }
  async function applyFix() {
    const list = prop ?? []
    for (const x of list) { const old = secs.find(y => y.id === x.id); await supabase.from('project_sections').update({ previous_content: old?.content, content: x.text, user_edited: true, updated_at: new Date().toISOString() }).eq('id', x.id) }
    setNote(`I applied your corrections to ${list.length} section(s). Open the Editor to read them, and download the chapter when you are happy.`); closeFix(); await load()
  }

  async function readFiles(files: File[]) {
    if (!up) return; const c = up.c
    const imgs = files.filter(f => f.type.startsWith('image/')), docs = files.filter(f => /\.docx$/i.test(f.name))
    if (!imgs.length && !docs.length) return setUp({ ...up, msg: 'Please choose photos (JPG or PNG) or a Word (.docx) file.' })
    const items: Row[] = []; const skipped: string[] = []
    const say = (msg: string) => setUp(u => u && { ...u, phase: 'busy', msg })
    try {
      for (const [i, f] of imgs.entries()) {
        say(`Reading page ${i + 1} of ${imgs.length}…`)
        const im = await toJpeg(f); const r = await callAI({ action: 'read_page', projectId: id, chapterId: c.id, image: im.data, mime: im.mime })
        if (!r.ok) { skipped.push(`Photo ${i + 1}: ${r.error ?? 'could not be read'}`); continue }
        ;(r.items ?? []).forEach((x: Row) => items.push({ ...x, page: `Photo ${i + 1}` }))
      }
      for (const f of docs) {
        say('Reading the comments in your Word file…')
        const marks = await readDocxMarks(f)
        if (!marks.length) { skipped.push(`${f.name}: no comments or tracked changes were found`); continue }
        const r = await callAI({ action: 'place_items', projectId: id, chapterId: c.id, items: marks })
        if (!r.ok) { skipped.push(`${f.name}: ${r.error ?? 'could not be read'}`); continue }
        ;(r.items ?? []).forEach((x: Row) => items.push({ ...x, page: f.name }))
      }
    } catch { skipped.push('Something went wrong while reading the files. Please try again.') }
    setUp({ c, phase: 'review', msg: '', items, skipped })
  }
  async function applyMarks() {
    if (!up) return
    const usable = up.items.filter(x => x.sectionId && !/unreadable/i.test(x.note ?? ''))
    const groups = new Map<string, Row[]>(); usable.forEach(x => groups.set(x.sectionId, [...(groups.get(x.sectionId) ?? []), x]))
    const changes: Row[] = []; const fails: string[] = []; let n = 0
    for (const [sid, marks] of groups) {
      setUp(u => u && { ...u, phase: 'busy', msg: `Correcting section ${++n} of ${groups.size}…` })
      const r = await callAI({ action: 'rewrite_with_marks', projectId: id, sectionId: sid, marks })
      if (r.ok) changes.push({ id: r.id, heading: r.heading, text: r.text }); else fails.push(r.error ?? 'A section could not be corrected.')
    }
    const c = up.c; setUp(null); if (fails.length) setErr(fails[0]); setFix(c); setProp(changes)
  }
  const started = secs.some(x => x.status === 'completed')
  const mineOf = (c: Row) => secs.filter(x => x.chapter_id === c.id)
  const readyOf = (c: Row) => mineOf(c).length > 0 && mineOf(c).every(x => x.status === 'completed')
  const dl = 'btn-ghost !px-3 !py-2 text-sm'

  return <Shell id={id} p={p}>
    <h1 className="font-display text-2xl font-semibold">Your project</h1>
    {!secs.length && <div className="mt-4"><p className="font-medium">How detailed should your project be?</p><p className="mb-3 text-sm text-ink/60">Page count is approximate. Real length depends on font, spacing, tables, figures and references.</p>
      <div className="flex flex-wrap gap-2">{[20, 40, 60, 80, 100].map(n => <button key={n} onClick={() => setPages(n)} className={`rounded-lg border px-4 py-2 ${pages === n ? 'border-gold bg-gold/10' : 'border-line bg-white'}`}>{n}{n === 100 ? '+' : ''} pages</button>)}</div>
      <button className="btn-gold mt-5" disabled={planning} onClick={plan}>{planning ? 'Working…' : 'Create my table of contents'}</button>
      {planning && <div className="mt-5"><Ring pct={tp.pct} label="Researching your topic and building your contents" sub={tp.over ? 'Almost done…' : `About ${tp.left}s left`} /></div>}</div>}
    {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</p>}
    {note && <div className="mt-4 rounded-xl border-l-4 border-gold bg-white p-4 text-sm leading-6"><p className="font-semibold">Famzuk</p><p>{note}</p></div>}
    {runId && <div className="mt-4">{refBusy ? <Ring pct={tr.pct} label="Finding and checking real references…" sub={tr.over ? 'Almost done…' : `About ${tr.left}s left`} /> : (() => { const c = chs.find(x => x.id === runId)!; const m = mineOf(c); const d = m.filter(x => x.status === 'completed').length; return <Ring pct={m.length ? Math.round((d / m.length) * 100) : 0} label={act || 'Working…'} sub={eta > 0 ? `About ${eta >= 90 ? Math.round(eta / 60) + ' min' : eta + 's'} left in this chapter` : undefined} /> })()}
      <button className="btn-ghost mt-3 !py-2 text-sm" onClick={() => (stop.current = true)}>Pause</button></div>}
    {secs.length > 0 && <>
      {!started && searched === true && <p className="mt-3 text-sm text-green-800">This outline was checked against Google Search results.</p>}
      {!started && searched === false && <p className="mt-3 text-sm text-amber-800">Google Search was unavailable (quota), so this outline came from the AI's own knowledge. Please review it before writing.</p>}
      {!started && <p className="mt-3 text-sm text-ink/70">Remove any section you do not want with ×, or regenerate the contents. Then start with Chapter One.</p>}
      <div className="mt-4 rounded-xl border border-line bg-white p-4"><p className="font-semibold">Preliminary Pages</p><ul className="ml-5 mt-1 list-disc text-sm text-ink/70">{PRE.map(x => <li key={x}>{x}</li>)}</ul></div>
      {chs.map((c, i) => {
        const m = mineOf(c); const d = m.filter(x => x.status === 'completed').length; const ready = readyOf(c); const here = runId === c.id
        const prevReady = i === 0 || readyOf(chs[i - 1]); const W = CHW[i] ?? String(i + 1)
        return <article key={c.id} className="mt-4 rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-semibold">CHAPTER {W}: {String(c.title).toUpperCase()}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ready ? 'bg-green-100 text-green-800' : d ? 'bg-gold/20' : 'bg-tab text-ink/60'}`}>{ready ? 'Ready' : here ? 'Writing…' : d ? `${d}/${m.length} written` : 'Not started'}</span></div>
          <ul className="mt-2 space-y-1 text-sm">{m.map((x, j) => <li key={x.id} className="flex items-center justify-between gap-2"><span className="text-ink/80">{ready || x.status === 'completed' ? '✓ ' : ''}{i + 1}.{j + 1} {x.heading}</span>{!d && !here && !started && <button aria-label="Remove section" className="px-2 text-ink/40 hover:text-red-700" onClick={() => remove(x.id)}>×</button>}</li>)}</ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {!ready && <button className="btn-gold !px-4 !py-2 text-sm" disabled={!!runId || !prevReady || !m.length} onClick={() => writeChapter(c)}>{here ? 'Writing…' : d ? `Continue Chapter ${W}` : `Write Chapter ${W}`}</button>}
            {ready && <button className={dl} disabled={!!runId} onClick={() => { if (confirm(m.some(x => x.user_edited) ? 'You edited some sections. Rewriting replaces ALL of them. Continue?' : 'Rewrite this whole chapter from the start?')) writeChapter(c, true) }}>Rewrite</button>}
            {d > 0 && <button className={dl} onClick={() => setFix(c)}>Correct this chapter</button>}
            {d > 0 && <button className={dl} onClick={() => setUp({ c, phase: 'pick', msg: '', items: [], skipped: [] })}>Lecturer's corrections (photo or Word)</button>}
            {d > 0 && <button className={dl} onClick={() => exportChapterPdf(id, c.id)}>PDF</button>}
            {d > 0 && <button className={dl} onClick={() => exportChapterDocx(id, c.id)}>DOCX</button>}
            {d > 0 && <Link className={dl} to={`/projects/${id}/editor`}>Open Editor</Link>}
          </div>
          {!prevReady && !ready && <p className="mt-2 text-xs text-ink/50">Finish Chapter {CHW[i - 1]} first.</p>}
        </article>
      })}
      {!started && !runId && <button className="btn-ghost mt-4" disabled={planning} onClick={plan}>{planning ? 'Regenerating…' : 'Regenerate contents'}</button>}
      <p className="mt-3 text-sm text-ink/60">Keep this tab open while a chapter is being written. Each section is saved as soon as it is done.</p>
    </>}
    {up && <Modal title={`Lecturer's corrections: Chapter ${CHW[chs.findIndex(x => x.id === up.c.id)] ?? ''}`} onClose={() => { if (up.phase !== 'busy') setUp(null) }}>
      {up.phase === 'pick' && <>
        <p className="text-sm text-ink/60">Take a clear photo of every page your lecturer marked (you can choose many photos at once), or upload the Word file with the lecturer's comments. The AI finds the lines, circles and notes, matches them to the right section, and corrects only those places.</p>
        <label className="btn-gold mt-4 cursor-pointer">Choose photos or a Word file<input type="file" multiple accept="image/*,.docx" className="hidden" onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) readFiles(f); e.target.value = '' }} /></label>
        {up.msg && <p role="alert" className="mt-3 text-sm text-red-700">{up.msg}</p>}
        <p className="mt-3 text-xs text-ink/50">Tips: lay the page flat, use good light, keep the whole page in the picture, and take one photo per page. The pages should be printed from this chapter.</p>
      </>}
      {up.phase === 'busy' && <p className="text-sm">{up.msg} Please wait, this can take a few minutes.</p>}
      {up.phase === 'review' && <>
        {up.items.length === 0 ? <p className="text-sm">I could not find any marks. Try clearer photos, or type the correction with "Correct this chapter".</p> : <>
          <p className="text-sm font-semibold">I found {up.items.filter(x => x.sectionId).length} mark(s). Remove any that are wrong, then apply.</p>
          <ul className="mt-2 space-y-2">{up.items.map((x, k) => x.sectionId && <li key={k} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex items-start justify-between gap-2"><span className="font-semibold">{x.label} <span className="font-normal text-ink/50">({x.page})</span></span><button aria-label="Remove this mark" className="px-2 text-ink/40 hover:text-red-700" onClick={() => setUp(u => u && { ...u, items: u.items.filter((_, i) => i !== k) })}>×</button></div>
            {x.marked && <p className="mt-1 text-ink/70">Marked: "{x.marked}"</p>}
            <p className="mt-1">{x.note ? (/unreadable/i.test(x.note) ? 'Note could not be read. This mark will be skipped.' : `Note: ${x.note}`) : 'Line or circle only, no note. I will fix or improve those words.'}</p></li>)}</ul>
          {up.items.some(x => !x.sectionId) && <div className="mt-3"><p className="text-sm font-semibold">Could not match to a section (skipped)</p><ul className="ml-5 list-disc text-sm text-ink/70">{up.items.filter(x => !x.sectionId).map((x, k) => <li key={k}>{x.marked || 'Unmarked text'}{x.note ? `: ${x.note}` : ''}</li>)}</ul></div>}
        </>}
        {up.skipped.length > 0 && <ul className="mt-3 ml-5 list-disc text-sm text-amber-800">{up.skipped.map((m, k) => <li key={k}>{m}</li>)}</ul>}
        <div className="mt-4 flex flex-wrap justify-end gap-2"><button className="btn-ghost" onClick={() => setUp({ ...up, phase: 'pick', msg: '' })}>Choose other files</button><button className="btn-primary" disabled={!up.items.some(x => x.sectionId && !/unreadable/i.test(x.note ?? ''))} onClick={applyMarks}>Apply corrections</button></div>
      </>}
    </Modal>}
    {fix && <Modal title={`Correct Chapter ${CHW[chs.findIndex(x => x.id === fix.id)] ?? ''}`} onClose={closeFix}>
      {!prop ? <>
        <p className="text-sm text-ink/60">Type what your lecturer wrote about this chapter. The AI changes only the sections that need it, and you check them before anything is saved.</p>
        <textarea className="input mt-3 min-h-[30vh] resize-y" placeholder="e.g. Rewrite the problem statement so it follows the objectives, and add more recent studies" value={corr} onChange={e => setCorr(e.target.value)} autoFocus />
        {ferr && <p role="alert" className="mt-2 text-sm text-red-700">{ferr}</p>}
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={closeFix}>Cancel</button><button className="btn-gold" disabled={cbusy || !corr.trim()} onClick={checkFix}>{cbusy ? 'Checking the chapter… (up to a minute)' : 'Apply correction'}</button></div>
      </> : prop.length === 0 ? <>
        <p className="text-sm">I did not find anything in this chapter that needs to change for that note. Try describing the problem more exactly.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setProp(null)}>Back</button></div>
      </> : <>
        <p className="text-sm font-semibold">{prop.length} section(s) changed (preview)</p>
        {prop.map(x => <div key={x.id} className="mt-3"><p className="text-sm font-semibold">{x.heading}</p><div className="mt-1 max-h-[28vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gold bg-gold/5 p-3 text-sm leading-6">{x.text}</div></div>)}
        <div className="mt-4 flex flex-wrap justify-end gap-2"><button className="btn-ghost" onClick={() => setProp(null)}>Back</button><button className="btn-primary" onClick={applyFix}>Keep these changes</button></div>
      </>}
    </Modal>}
  </Shell>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k); const o = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = o }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-display text-lg font-semibold">{title}</h2><button aria-label="Close" className="rounded-lg px-3 py-1 text-2xl leading-none text-ink/60 hover:bg-tab" onClick={onClose}>×</button></div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>)
}

export function Editor() {
  const { id, p } = useProject()
  const [chs, setChs] = useState<Row[]>([]), [secs, setSecs] = useState<Row[]>([]), [sel, setSel] = useState('')
  const [modal, setModal] = useState<null | 'edit' | 'correct' | 'scan' | 'toc'>(null)
  const [txt, setTxt] = useState(''), [corr, setCorr] = useState(''), [prop, setProp] = useState(''), [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  const [img, setImg] = useState<{ data: string; mime: string } | null>(null), [sc, setSc] = useState<any>(null), [sbusy, setSbusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null), docRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    const [a, b] = await Promise.all([supabase.from('project_chapters').select('*').eq('project_id', id).order('position'), supabase.from('project_sections').select('*').eq('project_id', id).order('position')])
    setChs(a.data ?? []); setSecs(b.data ?? []); if (!sel && b.data?.length) setSel(b.data[0].id)
  }
  useEffect(() => { load(); supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')) }, [id])

  const idx = secs.findIndex(x => x.id === sel); const s = secs[idx]; const ch = chs.find(c => c.id === s?.chapter_id)
  const label = (x: Row) => `${chs.find(c => c.id === x.chapter_id)?.position}.${secs.filter(y => y.chapter_id === x.chapter_id).indexOf(x) + 1} ${x.heading}`
  const close = () => { setModal(null); setProp(''); setSc(null); setSbusy(false) }
  const go = (d: number) => { const n = secs[idx + d]; if (n) { setSel(n.id); setMsg(''); docRef.current?.scrollTo({ top: 0 }) } }
  const block = (e: { preventDefault: () => void }) => e.preventDefault()

  async function save() { if (!s) return; await supabase.from('project_sections').update({ previous_content: s.content, content: txt, user_edited: true, updated_at: new Date().toISOString() }).eq('id', sel); setMsg('Saved'); close(); await load() }
  async function regen() {
    if (!s) return; if (s.user_edited && !confirm('You edited this section. Regenerating will replace your changes. Continue?')) return
    setBusy(true); setMsg(''); const r = await callAI({ action: 'generate_section', projectId: id, sectionId: sel })
    if (r.ok) await supabase.from('project_sections').update({ user_edited: false }).eq('id', sel)
    setMsg(r.ok ? 'Section regenerated' : r.error ?? 'Could not regenerate. Please try again.'); await load(); setBusy(false)
  }
  async function askCorrection() { if (!s || !corr.trim()) return; setBusy(true); const r = await callAI({ action: 'correct_section', projectId: id, sectionId: sel, instruction: corr }); setBusy(false); if (r.ok) setProp(r.text); else setMsg(r.error ?? 'Could not apply the correction. Please try again.') }
  async function applyCorrection() { await supabase.from('project_sections').update({ previous_content: s?.content, content: prop, user_edited: true, updated_at: new Date().toISOString() }).eq('id', sel); setMsg('Correction applied'); setCorr(''); close(); await load() }
  async function undo() { if (!s?.previous_content) return; await supabase.from('project_sections').update({ content: s.previous_content, previous_content: null }).eq('id', sel); setMsg('Previous version restored'); await load() }
  async function runScan(im: { data: string; mime: string }, force?: number) {
    setSbusy(true); setSc(null); const r = await callAI({ action: 'scan_correction', projectId: id, image: im.data, mime: im.mime, forceSection: force }); setSbusy(false)
    if (!r.ok) return setSc({ error: r.error ?? 'Could not read the page. Please try a clearer photo.' })
    setSc(r); if (r.sectionId) setSel(r.sectionId)
  }
  async function onFile(f: File) { setModal('scan'); setSc(null); try { const im = await toJpeg(f); setImg(im); await runScan(im) } catch { setSc({ error: 'That file could not be read as a photo. Please try another one.' }) } }
  async function applyScan() { const t = secs.find(x => x.id === sc.sectionId); await supabase.from('project_sections').update({ previous_content: t?.content, content: sc.text, user_edited: true, updated_at: new Date().toISOString() }).eq('id', sc.sectionId); setMsg('Correction applied to ' + sc.label); close(); await load() }

  const toc = (done: () => void) => chs.map(c => (
    <div key={c.id} className="mb-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/60">Chapter {c.position}: {c.title}</p>
      {secs.filter(x => x.chapter_id === c.id).map((x, j) => (
        <button key={x.id} onClick={() => { setSel(x.id); setMsg(''); done() }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${sel === x.id ? 'bg-gold/20 font-semibold' : 'hover:bg-ink/5'}`}>
          {c.position}.{j + 1} {x.heading}{x.status !== 'completed' && <i className="ml-1 text-xs text-ink/50">({x.status})</i>}
        </button>))}
    </div>))
  const sm = 'btn-ghost !px-3 !py-2 text-sm'

  return (
    <Shell id={id} p={p} wide extra={toc}>
      <div className="flex flex-col gap-4 lg:h-[calc(100vh-3rem)]">
        <section className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          {!s ? <p>No sections yet. <Link className="underline" to={`/projects/${id}/generate`}>Generate your project</Link>.</p> : <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-ink/60">{ch ? `Chapter ${ch.position}: ${ch.title}` : ''}</p><h2 className="font-display text-xl font-semibold">{label(s)}</h2></div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button className={sm} onClick={() => { setTxt(s.content ?? ''); setModal('edit') }}>Edit</button>
              <button className={sm} disabled={busy} onClick={regen}>{busy ? 'Working…' : 'Regenerate'}</button>
              <button className={sm} onClick={() => setModal('correct')}>Lecturer note</button>
              <button className={sm} onClick={() => fileRef.current?.click()}>Scan page</button>
              <button className={sm} onClick={() => exportSectionPdf(label(s), s.content ?? '')}>PDF</button>
              <button className={sm} onClick={() => exportSectionDocx(label(s), s.content ?? '')}>DOCX</button>
              {s.previous_content && <button className={sm} onClick={undo}>Undo</button>}
            </div>
            {msg && <p role="status" className="mb-2 text-sm text-ink/70">{msg}</p>}
            <div ref={docRef} className="relative min-h-[45vh] select-none overflow-y-auto rounded-xl border border-line bg-white p-5 leading-7 sm:p-8 lg:min-h-0 lg:flex-1" onContextMenu={block} onCopy={block} onCut={block} onDragStart={block}>
              <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden text-2xl font-bold text-ink/5 -rotate-12 sm:text-3xl">{email}</div>
              <div className="relative whitespace-pre-wrap">{clean(s.content || 'Not written yet.')}</div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button className={sm} disabled={idx <= 0} onClick={() => go(-1)}>← Previous</button>
              <span className="text-xs text-ink/50">{idx + 1} of {secs.length}</span>
              <button className={sm} disabled={idx >= secs.length - 1} onClick={() => go(1)}>Next →</button>
            </div>
            <p className="mt-2 text-xs text-ink/50">Copy protection only discourages casual copying. Screenshots and other tools can still capture this text.</p>
          </>}
        </section>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />

      {modal === 'edit' && s && <Modal title={`Edit ${label(s)}`} onClose={close}>
        <textarea className="input min-h-[50vh] resize-y leading-7" value={txt} onChange={e => setTxt(e.target.value)} autoFocus />
        <p className="mt-2 text-xs text-ink/50">{txt.trim() ? txt.trim().split(/\s+/).length : 0} words</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={close}>Cancel</button><button className="btn-primary" onClick={save}>Save changes</button></div>
      </Modal>}

      {modal === 'correct' && s && <Modal title="Lecturer note" onClose={close}>
        {!prop ? <>
          <p className="text-sm text-ink/60">Type what your lecturer wrote about <b>{label(s)}</b>. The AI changes only what is needed, and you check it before it is saved.</p>
          <textarea className="input mt-3 min-h-[30vh] resize-y" placeholder="e.g. Add more recent studies and explain the problem more clearly" value={corr} onChange={e => setCorr(e.target.value)} autoFocus />
          <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={close}>Cancel</button><button className="btn-gold" disabled={busy || !corr.trim()} onClick={askCorrection}>{busy ? 'Applying…' : 'Apply correction'}</button></div>
        </> : <>
          <p className="text-sm font-semibold">Corrected version (preview)</p>
          <div className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gold bg-gold/5 p-3 text-sm leading-6">{prop}</div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><button className="btn-ghost" onClick={() => setProp('')}>Back</button><button className="btn-ghost" onClick={() => exportSectionPdf(label(s), prop)}>PDF</button><button className="btn-ghost" onClick={() => exportSectionDocx(label(s), prop)}>DOCX</button><button className="btn-primary" onClick={applyCorrection}>Keep this version</button></div>
        </>}
      </Modal>}

      {modal === 'scan' && <Modal title="Scan a marked page" onClose={close}>
        {sbusy && <p className="text-sm">Reading the page and applying the corrections… this can take up to a minute.</p>}
        {sc?.error && <><p role="alert" className="text-sm text-red-700">{sc.error}</p><div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={close}>Close</button><button className="btn-primary" onClick={() => fileRef.current?.click()}>Try another photo</button></div></>}
        {sc?.needsSection && <><p className="text-sm">I could not tell which section this page belongs to. Please choose it:</p>
          <select className="input mt-3" defaultValue="" onChange={e => img && runScan(img, Number(e.target.value))}><option value="" disabled>Choose the section</option>{sc.sections.map((x: any) => <option key={x.index} value={x.index}>{x.label}</option>)}</select></>}
        {sc?.noComments && <><p className="text-sm text-amber-800">This page matches <b>{sc.label}</b>, but I could not read any corrections on it.</p><div className="mt-4 flex justify-end gap-2"><button className="btn-primary" onClick={() => setModal('correct')}>Type the correction instead</button></div></>}
        {sc?.text && <>
          <p className="text-sm font-semibold">Found: {sc.label}{sc.confidence === 'low' ? ' (not sure, please check)' : ''}</p>
          <p className="mt-3 text-sm font-semibold">Corrections I read</p>
          <ul className="ml-5 list-disc text-sm">{sc.comments.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
          <p className="mt-3 text-sm font-semibold">Corrected version (preview)</p>
          <div className="mt-1 max-h-[35vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gold bg-gold/5 p-3 text-sm leading-6">{sc.text}</div>
          <label className="mt-3 block text-sm">Wrong section?
            <select className="input mt-1" defaultValue="" onChange={e => img && runScan(img, Number(e.target.value))}><option value="" disabled>Change section</option>{secs.map((x, i) => <option key={x.id} value={i}>{label(x)}</option>)}</select></label>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><button className="btn-ghost" onClick={close}>Discard</button><button className="btn-ghost" onClick={() => exportSectionPdf(sc.label, sc.text)}>PDF</button><button className="btn-ghost" onClick={() => exportSectionDocx(sc.label, sc.text)}>DOCX</button><button className="btn-primary" onClick={applyScan}>Keep this version</button></div>
        </>}
      </Modal>}
    </Shell>)
}

export function Sources() {
  const { id, p } = useProject(); const [rows, setRows] = useState<Row[]>([]); const [c, setC] = useState(''); const [fb, setFb] = useState(''), [fbusy, setFbusy] = useState(false); const tf = useTimed(fbusy, 75)
  const load = () => supabase.from('project_sources').select('*').eq('project_id', id).order('created_at').then(({ data }) => setRows(data ?? [])); useEffect(() => { load() }, [id])
  return <Shell id={id} p={p}><h1 className="font-display text-2xl font-semibold">Sources</h1><p className="mb-4 text-sm text-ink/60">Add only real sources. The AI never invents references. Mark a source “verified” once you have checked it.</p>
    <div className="mb-4"><button className="btn-gold" disabled={fbusy} onClick={async () => { setFbusy(true); setFb(''); const r = await callAI({ action: 'find_references', projectId: id }); setFbusy(false); setFb(r.error ?? `Added ${r.added} references (${r.verified} link-checked). Open each link to confirm it.`); load() }}>{fbusy ? 'Searching…' : 'Find 30 references with AI'}</button>{fbusy && <div className="mt-3"><Ring pct={tf.pct} label="Searching scholarly databases and checking links" sub={tf.over ? 'Almost done…' : `About ${tf.left}s left`} /></div>}{fb && <p className="mt-2 text-sm">{fb}</p>}</div>
    <div className="flex gap-2"><input className="input" placeholder="Full citation" value={c} onChange={e => setC(e.target.value)} /><button className="btn-primary" disabled={!c.trim()} onClick={async () => { await supabase.from('project_sources').insert({ project_id: id, citation: c }); setC(''); load() }}>Add</button></div>
    <ul className="mt-4 space-y-2">{rows.map(r => <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-white p-3"><span className="min-w-0 flex-1">{r.citation}</span>
      <select className="input !w-auto" value={r.provenance} onChange={async e => { await supabase.from('project_sources').update({ provenance: e.target.value }).eq('id', r.id); load() }}>{['student_provided', 'needs_verification', 'verified', 'ai_generated'].map(x => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select>
      <button className="btn-ghost !py-1.5" onClick={async () => { await supabase.from('project_sources').delete().eq('id', r.id); load() }}>Remove</button></li>)}</ul></Shell>
}

export function Settings() {
  const { id, p, reload } = useProject(); const nav = useNavigate()
  return <Shell id={id} p={p}><h1 className="font-display text-2xl font-semibold">Settings</h1>
    <label className="mt-4 block text-sm font-medium">Writing style</label><select className="input mt-1 max-w-xs" value={p?.style ?? 'simple_english'} onChange={async e => { await supabase.from('projects').update({ style: e.target.value }).eq('id', id); reload() }}><option value="simple_english">Simple English</option><option value="standard_academic">Standard Academic</option><option value="detailed_academic">Detailed Academic</option></select>
    <h2 className="mt-8 font-semibold">Export</h2><div className="mt-2 flex gap-2"><button className="btn-primary" onClick={() => exportPdf(id)}>Download PDF</button><button className="btn-ghost" onClick={() => exportDocx(id)}>Download DOCX</button></div>
    <button className="btn-ghost mt-8 text-red-700" onClick={async () => { if (confirm('Delete this project permanently?')) { await supabase.from('projects').delete().eq('id', id); nav('/dashboard') } }}>Delete project</button></Shell>
}
