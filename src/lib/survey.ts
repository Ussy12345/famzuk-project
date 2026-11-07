export type Q = { intro?: string; demographics: { label?: string; question: string; options: string[] }[]; sections: { title: string; objective?: string; items: string[] }[] }
export type Table = { id: string; caption: string; headers: string[]; rows: (string | number)[][]; chart?: { type: 'bar'; labels: string[]; values: number[]; unit: string } }
export type Results = { n: number; benchmark: number; tables: Table[]; warnings: string[] }

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const SCALE: Record<string, number> = { 'strongly agree': 5, sa: 5, agree: 4, a: 4, undecided: 3, neutral: 3, u: 3, disagree: 2, d: 2, 'strongly disagree': 1, sd: 1 }
export const likert = (v: unknown): number | undefined => { const s = norm(v); if (/^[1-5](\.0+)?$/.test(s)) return Math.round(Number(s)); return SCALE[s] }
const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100
const decide = (m: number) => (m >= 3 ? 'Agree' : 'Disagree')

export function templateCsv(q: Q) {
  const cols = [...q.demographics.map(d => d.question), ...q.sections.flatMap(s => s.items)]
  return '\ufeff' + cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n'
}

export function analyze(q: Q, header: string[], rows: unknown[][]): Results {
  const qs = [...q.demographics.map(d => d.question), ...q.sections.flatMap(s => s.items)]
  const h = header.map(norm), order = header.length === qs.length
  const idx = qs.map((t, i) => { const j = h.indexOf(norm(t)); return j >= 0 ? j : order ? i : -1 })
  const warnings: string[] = []
  idx.forEach((j, i) => { if (j < 0) warnings.push(`No column found for: ${qs[i].slice(0, 70)}`) })
  const data = rows.filter(r => r.some(c => String(c ?? '').trim() !== ''))
  const tables: Table[] = []; let t = 0; const next = () => `4.${++t}`

  q.demographics.forEach((d, di) => {
    const col = idx[di]; if (col < 0) return
    const counts = d.options.map(o => data.filter(r => norm(r[col]) === norm(o)).length)
    const total = counts.reduce((a, b) => a + b, 0)
    if (!total) { warnings.push(`No answers matched the options for: ${d.question.slice(0, 60)}`); return }
    if (total < data.length) warnings.push(`${data.length - total} answer(s) to "${d.question.slice(0, 50)}" did not match the listed options and were left out.`)
    const pct = counts.map(c => r1((c / total) * 100))
    tables.push({ id: next(), caption: `Distribution of respondents by ${(d.label || d.question).toLowerCase()}`, headers: ['Option', 'Frequency', 'Percentage (%)'], rows: [...d.options.map((o, i) => [o, counts[i], pct[i]]), ['Total', total, 100]], chart: { type: 'bar', labels: d.options, values: pct, unit: '%' } })
  })

  let k = q.demographics.length; const sm: (string | number)[][] = []; let bad = 0
  q.sections.forEach(sec => {
    const rowsT: (string | number)[][] = []; const means: number[] = []; const labels: string[] = []
    sec.items.forEach((item, i) => {
      const col = idx[k++]; const vals: number[] = []
      if (col >= 0) data.forEach(r => { const v = likert(r[col]); if (v) vals.push(v); else if (String(r[col] ?? '').trim() !== '') bad++ })
      if (!vals.length) return
      const m = vals.reduce((a, b) => a + b, 0) / vals.length
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, vals.length - 1))
      const c = [5, 4, 3, 2, 1].map(s => vals.filter(v => v === s).length)
      rowsT.push([i + 1, item, ...c, r2(m), r2(sd), decide(m)]); means.push(m); labels.push(`Q${i + 1}`)
    })
    if (!means.length) return
    const gm = means.reduce((a, b) => a + b, 0) / means.length
    rowsT.push(['', 'Section mean', '', '', '', '', '', r2(gm), '', decide(gm)])
    tables.push({ id: next(), caption: sec.title, headers: ['S/N', 'Statement', 'SA (5)', 'A (4)', 'U (3)', 'D (2)', 'SD (1)', 'Mean', 'Std. Dev.', 'Decision'], rows: rowsT, chart: { type: 'bar', labels, values: means.map(r2), unit: 'mean' } })
    sm.push([sec.title, r2(gm), decide(gm)])
  })
  if (sm.length > 1) tables.push({ id: next(), caption: 'Summary of section means', headers: ['Section', 'Mean', 'Decision'], rows: sm })
  if (bad) warnings.push(`${bad} rating(s) were not a valid 1 to 5 score or agreement word and were left out.`)
  return { n: data.length, benchmark: 3, tables, warnings }
}
