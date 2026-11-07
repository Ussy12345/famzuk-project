import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, callAI } from '../lib/supabase'
import { Shell, useProject } from './ProjectPages'
import { analyze, templateCsv, type Q, type Results } from '../lib/survey'

type Row = Record<string, any>

function Bars({ labels, values, unit }: { labels: string[]; values: number[]; unit: string }) {
  const max = unit === '%' ? 100 : 5
  return (
    <div className="mt-3 space-y-1.5 rounded-xl border border-line bg-white p-3" role="img" aria-label="Bar chart">
      {labels.map((l, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate sm:w-36" title={l}>{l}</span>
          <div className="h-4 flex-1 rounded bg-tab"><div className="h-4 rounded bg-gold" style={{ width: `${Math.min(100, (values[i] / max) * 100)}%` }} /></div>
          <span className="w-12 shrink-0 text-right font-medium">{values[i]}{unit === '%' ? '%' : ''}</span>
        </div>))}
    </div>)
}

async function downloadQuestionnaire(q: Q, topic: string) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } = await import('docx')
  const kids: any[] = [new Paragraph({ text: 'QUESTIONNAIRE', heading: HeadingLevel.HEADING_1 }), new Paragraph({ text: topic }), new Paragraph({ text: q.intro ?? '' }), new Paragraph({ text: 'SECTION A: Personal Information', heading: HeadingLevel.HEADING_2 })]
  q.demographics.forEach((d, i) => { kids.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${d.question}`, bold: true })] })); d.options.forEach(o => kids.push(new Paragraph({ text: `[  ] ${o}` }))) })
  const cell = (t: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold })] })] })
  q.sections.forEach((s, si) => {
    kids.push(new Paragraph({ text: `SECTION ${String.fromCharCode(66 + si)}: ${s.title}`, heading: HeadingLevel.HEADING_2 }))
    kids.push(new Paragraph({ text: 'Tick the option that matches your opinion. SA = Strongly Agree, A = Agree, U = Undecided, D = Disagree, SD = Strongly Disagree.' }))
    kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: ['S/N', 'Statement', 'SA', 'A', 'U', 'D', 'SD'].map(h => cell(h, true)) }), ...s.items.map((it, i) => new TableRow({ children: [String(i + 1), it, '', '', '', '', ''].map(c => cell(c)) }))] }))
  })
  const a = document.createElement('a'); a.href = URL.createObjectURL(await Packer.toBlob(new Document({ sections: [{ children: kids }] }))); a.download = 'Questionnaire.docx'; a.click()
}

export default function Survey() {
  const { id, p } = useProject()
  const [q, setQ] = useState<Q | null>(null), [res, setRes] = useState<Results | null>(null)
  const [secs, setSecs] = useState<Row[]>([]), [chs, setChs] = useState<Row[]>([])
  const [target, setTarget] = useState(''), [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [done, setDone] = useState('')

  async function load() {
    const [a, b, c] = await Promise.all([
      supabase.from('project_surveys').select('*').eq('project_id', id).maybeSingle(),
      supabase.from('project_chapters').select('*').eq('project_id', id).order('position'),
      supabase.from('project_sections').select('*').eq('project_id', id).order('position')])
    setQ(a.data?.questionnaire ?? null); setRes(a.data?.results ?? null); setChs(b.data ?? []); setSecs(c.data ?? [])
    const ch4 = (b.data ?? []).find((x: Row) => x.position === 4); const inCh4 = (c.data ?? []).filter((x: Row) => x.chapter_id === ch4?.id)
    setTarget((inCh4.find((x: Row) => /present|analy|result|finding/i.test(x.heading)) ?? inCh4[0])?.id ?? '')
  }
  useEffect(() => { load() }, [id])

  async function generate() {
    if (q && !confirm('This replaces the current questionnaire and any uploaded responses. Continue?')) return
    setBusy('q'); setMsg(''); setDone('')
    const r = await callAI({ action: 'make_questionnaire', projectId: id }); setBusy('')
    if (r.ok) { setQ(r.questionnaire); setRes(null) } else setMsg(r.error ?? 'Could not create the questionnaire. Please try again.')
  }
  async function removeItem(si: number, ii: number) {
    if (!q) return; const n: Q = JSON.parse(JSON.stringify(q)); n.sections[si].items.splice(ii, 1)
    if (!n.sections[si].items.length) n.sections.splice(si, 1)
    await supabase.from('project_surveys').upsert({ project_id: id, questionnaire: n, data: null, results: null, updated_at: new Date().toISOString() })
    setQ(n); if (res) { setRes(null); setMsg('You changed the questionnaire, so please upload your responses again.') }
  }
  async function onFile(f: File) {
    if (!q) return; setBusy('u'); setMsg(''); setDone('')
    try {
      const XLSX = await import('xlsx'); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const grid = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }) as any[][]
      if (grid.length < 2) throw new Error('empty')
      const r = analyze(q, grid[0].map(String), grid.slice(1)); if (!r.n || !r.tables.length) throw new Error('nothing')
      await supabase.from('project_surveys').upsert({ project_id: id, data: { header: grid[0], rows: grid.slice(1) }, results: r, updated_at: new Date().toISOString() })
      setRes(r)
    } catch { setMsg('Could not read that file. Use the template (CSV or Excel) with one row per respondent and the same column headings.') }
    setBusy('')
  }
  async function write() {
    setBusy('w'); setMsg(''); setDone('')
    const r = await callAI({ action: 'write_results', projectId: id, sectionId: target }); setBusy('')
    if (r.ok) setDone('Written. Open the Editor to read and edit it.'); else setMsg(r.error ?? 'Could not write the results. Please try again.')
  }
  const dlTemplate = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([templateCsv(q!)], { type: 'text/csv;charset=utf-8' })); a.download = 'responses-template.csv'; a.click() }
  const lab = (x: Row) => `Chapter ${chs.find(c => c.id === x.chapter_id)?.position}: ${x.heading}`
  const card = 'mb-5 rounded-xl border border-line bg-white p-5'

  return (
    <Shell id={id} p={p} wide>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-semibold">Survey and data analysis</h1>
        <p className="mb-5 mt-1 text-sm text-ink/60">For projects that use a questionnaire. Your own responses are analysed by the app, so every figure in Chapter 4 comes from your data and nothing is made up.</p>
        {msg && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{msg}</p>}

        <div className={card}>
          <h2 className="font-semibold">1. Questionnaire</h2>
          {!q ? <><p className="mt-1 text-sm text-ink/60">The AI writes a questionnaire from your project objectives. You can remove statements you do not want.</p>
            <button className="btn-gold mt-3" disabled={busy === 'q'} onClick={generate}>{busy === 'q' ? 'Writing the questionnaire… (up to a minute)' : 'Create my questionnaire'}</button></> : <>
            <p className="mt-1 text-sm text-ink/60">{q.intro}</p>
            <div className="mt-3"><p className="text-sm font-semibold">Section A: Personal information</p><ul className="ml-5 list-disc text-sm">{q.demographics.map((d, i) => <li key={i}>{d.question} <span className="text-ink/50">({d.options.join(', ')})</span></li>)}</ul></div>
            {q.sections.map((s, si) => <div key={si} className="mt-3"><p className="text-sm font-semibold">Section {String.fromCharCode(66 + si)}: {s.title}</p>
              <ul className="mt-1 space-y-1 text-sm">{s.items.map((it, ii) => <li key={ii} className="flex items-start justify-between gap-2"><span>{ii + 1}. {it}</span><button aria-label="Remove statement" className="px-2 text-ink/40 hover:text-red-700" onClick={() => removeItem(si, ii)}>×</button></li>)}</ul></div>)}
            <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary !py-2 text-sm" onClick={() => downloadQuestionnaire(q, p?.topic ?? '')}>Download questionnaire (DOCX)</button><button className="btn-ghost !py-2 text-sm" onClick={dlTemplate}>Download response template (CSV)</button><button className="btn-ghost !py-2 text-sm" disabled={busy === 'q'} onClick={generate}>{busy === 'q' ? 'Working…' : 'Create a new one'}</button></div></>}
        </div>

        {q && <div className={card}>
          <h2 className="font-semibold">2. Your responses</h2>
          <p className="mt-1 text-sm text-ink/60">Collect your answers from respondents, put them in the template (one row per respondent), then upload it as CSV or Excel. Rate statements with 1 to 5 (5 = Strongly Agree) or the words Strongly Agree, Agree, Undecided, Disagree, Strongly Disagree. For the personal questions, type the option exactly as written.</p>
          <label className="btn-gold mt-3 cursor-pointer">{busy === 'u' ? 'Analysing…' : 'Upload responses'}<input type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={busy === 'u'} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} /></label>
          {res && <p className="mt-3 text-sm text-green-800">{res.n} respondents analysed.</p>}
          {res?.warnings.length ? <ul className="mt-2 ml-5 list-disc text-sm text-amber-800">{res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
        </div>}

        {res && <div className={card}>
          <h2 className="font-semibold">3. Results</h2>
          <p className="mb-3 mt-1 text-sm text-ink/60">Calculated by the app from your responses. Decision rule: a mean of {res.benchmark.toFixed(2)} or above means Agree.</p>
          {res.tables.map(t => <div key={t.id} className="mb-6"><p className="mb-2 text-sm font-semibold">Table {t.id}: {t.caption}</p>
            <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-sm"><thead><tr>{t.headers.map((h, i) => <th key={i} className="border-b border-line bg-tab px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-line px-3 py-2">{c}</td>)}</tr>)}</tbody></table></div>
            {t.chart && <Bars labels={t.chart.labels} values={t.chart.values} unit={t.chart.unit} />}</div>)}
        </div>}

        {res && <div className={card}>
          <h2 className="font-semibold">4. Write Chapter 4</h2>
          <p className="mt-1 text-sm text-ink/60">The AI explains the results above in simple English, using only your figures. Choose the section to write into. Existing text in it is replaced, and you can undo that in the Editor.</p>
          <select className="input mt-3" value={target} onChange={e => setTarget(e.target.value)}><option value="" disabled>Choose a section</option>{secs.map(x => <option key={x.id} value={x.id}>{lab(x)}</option>)}</select>
          <button className="btn-gold mt-3" disabled={!target || busy === 'w'} onClick={() => { const s = secs.find(x => x.id === target); if (s?.user_edited && !confirm('You edited this section. Writing will replace your changes. Continue?')) return; write() }}>{busy === 'w' ? 'Writing… (up to a minute)' : 'Write the analysis'}</button>
          {done && <p className="mt-3 text-sm text-green-800">{done} <Link className="underline" to={`/projects/${id}/editor`}>Open Editor</Link></p>}
        </div>}
      </div>
    </Shell>)
}
