import { supabase } from './supabase'
import { clean } from './clean'
type Row = Record<string, any>
async function collect(id: string) {
  const q = (t: string) => supabase.from(t).select('*').eq('project_id', id)
  const [p, ch, se, so] = await Promise.all([supabase.from('projects').select('*').eq('id', id).single(), q('project_chapters').order('position'), q('project_sections').order('position'), q('project_sources')])
  const sv = ((await q('project_surveys').maybeSingle()).data ?? null) as Row | null
  return { sv, p: p.data as Row, ch: (ch.data ?? []) as Row[], se: (se.data ?? []) as Row[], so: citedOnly((so.data ?? []) as Row[], (se.data ?? []) as Row[]) }
}
const label = (s: Row) => (s.provenance === 'verified' ? '' : ` [${String(s.provenance).replace('_', ' ')}]`)
export async function exportPdf(id: string) {
  const { jsPDF } = await import('jspdf'); const autoTable = (await import('jspdf-autotable')).default; const { p, ch, se, so, sv } = await collect(id)
  const d = new jsPDF({ unit: 'pt', format: 'a4' }); const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), m = 72; let y = m
  const add = (t: string, size: number, bold = false, gap = 8) => { d.setFont('times', bold ? 'bold' : 'normal'); d.setFontSize(size); for (const l of d.splitTextToSize(t, W - 2 * m)) { if (y > H - m) { d.addPage(); y = m } d.text(l, m, y); y += size * 1.5 } y += gap }
  d.setFont('times', 'bold'); d.setFontSize(20); d.text(d.splitTextToSize(String(p.topic).toUpperCase(), W - 2 * m), W / 2, 220, { align: 'center' })
  d.setFont('times', 'normal'); d.setFontSize(13); d.text([`A ${p.project_type} in ${p.course_name}`, p.institution, p.level], W / 2, 360, { align: 'center' }); d.addPage(); y = m
  ch.forEach((c, i) => { if (i) { d.addPage(); y = m } add(`CHAPTER ${WORDS[i] ?? i + 1}`, 14, true, 0); add(String(c.title).toUpperCase(), 14, true, 12)
    se.filter(s => s.chapter_id === c.id).forEach((s, j) => { add(`${i + 1}.${j + 1} ${s.heading}`, 12, true, 4); add(clean(s.content || '[Not yet written]'), 12); if (sv?.results && sv.section_id === s.id) y = pdfSurvey(d, autoTable, sv.results, y) }) })
  d.addPage(); y = m; add('REFERENCES', 14, true, 12); so.forEach(s => add(s.citation + label(s), 12, false, 4))
  if (sv?.questionnaire) { d.addPage(); y = m; add('APPENDIX A: QUESTIONNAIRE', 14, true, 12); add(questionnaireText(sv.questionnaire), 11) }
  const n = d.getNumberOfPages(); for (let i = 2; i <= n; i++) { d.setPage(i); d.setFontSize(10); d.text(String(i - 1), W / 2, H - 36, { align: 'center' }) }
  d.save(`${String(p.topic).slice(0, 40)}.pdf`)
}
export async function exportDocx(id: string) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, Footer, PageNumber, AlignmentType } = await import('docx'); const DX = await import('docx'); const { p, ch, se, so, sv } = await collect(id)
  const kids: any[] = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 3000 }, children: [new TextRun({ text: String(p.topic).toUpperCase(), bold: true, size: 40 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(`${p.project_type} — ${p.course_name}, ${p.institution}`)] })]
  ch.forEach((c, i) => { kids.push(new Paragraph({ text: `CHAPTER ${WORDS[i] ?? i + 1}: ${c.title}`.toUpperCase(), heading: HeadingLevel.HEADING_1, pageBreakBefore: true }))
    se.filter(s => s.chapter_id === c.id).forEach((s, j) => { kids.push(new Paragraph({ text: `${i + 1}.${j + 1} ${s.heading}`, heading: HeadingLevel.HEADING_2 }))
      clean(String(s.content || '[Not yet written]')).split(/\n+/).forEach(t => kids.push(new Paragraph({ spacing: { after: 160, line: 360 }, children: [new TextRun({ text: t, font: 'Times New Roman', size: 24 })] }))); if (sv?.results && sv.section_id === s.id) kids.push(...docxSurvey(DX, sv.results)) }) })
  kids.push(new Paragraph({ text: 'REFERENCES', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }), ...so.map(s => new Paragraph({ text: s.citation + label(s) })))
  if (sv?.questionnaire) kids.push(...docxQuestionnaire(DX, sv.questionnaire))
  const doc = new Document({ sections: [{ children: kids, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT] })] })] }) } }] })
  const a = document.createElement('a'); a.href = URL.createObjectURL(await Packer.toBlob(doc)); a.download = `${String(p.topic).slice(0, 40)}.docx`; a.click()
}

// Download only one section (used for corrected pages).
export async function exportSectionPdf(title: string, text: string) {
  const { jsPDF } = await import('jspdf'); const d = new jsPDF({ unit: 'pt', format: 'a4' }); const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), m = 72; let y = m
  d.setFont('times', 'bold'); d.setFontSize(14); for (const l of d.splitTextToSize(title, W - 2 * m)) { d.text(l, m, y); y += 22 } y += 8
  d.setFont('times', 'normal'); d.setFontSize(12)
  for (const l of d.splitTextToSize(clean(text), W - 2 * m)) { if (y > H - m) { d.addPage(); y = m } d.text(l, m, y); y += 18 }
  const n = d.getNumberOfPages(); for (let i = 1; i <= n; i++) { d.setPage(i); d.setFontSize(10); d.text(String(i), W / 2, H - 36, { align: 'center' }) }
  d.save(`${title.slice(0, 40)}.pdf`)
}
export async function exportSectionDocx(title: string, text: string) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx')
  const kids = [new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }), ...clean(text).split(/\n+/).map(t => new Paragraph({ spacing: { after: 160, line: 360 }, children: [new TextRun({ text: t, font: 'Times New Roman', size: 24 })] }))]
  const a = document.createElement('a'); a.href = URL.createObjectURL(await Packer.toBlob(new Document({ sections: [{ children: kids }] }))); a.download = `${title.slice(0, 40)}.docx`; a.click()
}

// ---------- Survey tables, charts and questionnaire in the full export ----------
function questionnaireText(q: Row): string {
  const L: string[] = [q.intro ?? '', '', 'SECTION A: Personal Information']
  ;(q.demographics ?? []).forEach((d: Row, i: number) => { L.push(`${i + 1}. ${d.question}`); L.push((d.options as string[]).map(o => `[  ] ${o}`).join('   ')) })
  ;(q.sections ?? []).forEach((s: Row, si: number) => {
    L.push('', `SECTION ${String.fromCharCode(66 + si)}: ${s.title}`, 'Key: SA = Strongly Agree, A = Agree, U = Undecided, D = Disagree, SD = Strongly Disagree')
    ;(s.items as string[]).forEach((it, i) => L.push(`${i + 1}. ${it}    SA [ ]   A [ ]   U [ ]   D [ ]   SD [ ]`))
  })
  return L.join('\n')
}
function pdfBars(d: any, c: Row, y0: number): number {
  const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), m = 72, rowH = 16
  let y = y0; if (y + c.labels.length * rowH + 20 > H - m) { d.addPage(); y = m }
  const labW = 120, barW = W - 2 * m - labW - 50, max = c.unit === '%' ? 100 : 5
  c.labels.forEach((l: string, i: number) => {
    d.setFont('times', 'normal'); d.setFontSize(9); d.setTextColor(20); d.text(String(l).slice(0, 22), m, y + 10)
    d.setFillColor(237, 234, 228); d.rect(m + labW, y + 2, barW, 10, 'F')
    d.setFillColor(200, 137, 58); d.rect(m + labW, y + 2, Math.max(0.5, barW * Math.min(1, c.values[i] / max)), 10, 'F')
    d.text(String(c.values[i]) + (c.unit === '%' ? '%' : ''), m + labW + barW + 6, y + 10); y += rowH
  })
  return y + 14
}
function pdfSurvey(d: any, autoTable: any, R: Row, y0: number): number {
  const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), m = 72; let y = y0 + 8
  for (const t of R.tables as Row[]) {
    if (y > H - 160) { d.addPage(); y = m }
    d.setFont('times', 'bold'); d.setFontSize(11); d.setTextColor(20)
    const cap = d.splitTextToSize(`Table ${t.id}: ${t.caption}`, W - 2 * m); d.text(cap, m, y); y += cap.length * 15 + 4
    autoTable(d, { startY: y, head: [t.headers], body: t.rows.map((r: any[]) => r.map(String)), theme: 'grid', styles: { font: 'times', fontSize: 9, cellPadding: 3, textColor: 20 }, headStyles: { fillColor: [237, 234, 228], textColor: 20 }, margin: { left: m, right: m } })
    y = d.lastAutoTable.finalY + 14
    if (t.chart) y = pdfBars(d, t.chart, y)
  }
  return y
}
function chartPng(c: Row): { data: Uint8Array; w: number; h: number } | null {
  const n = c.labels.length, w = 900, rowH = 44, h = n * rowH + 40
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); if (!g) return null
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.font = '22px Times New Roman'; g.textBaseline = 'middle'
  const max = c.unit === '%' ? 100 : 5, labW = 230, barW = w - labW - 110
  c.labels.forEach((l: string, i: number) => {
    const y = 20 + i * rowH
    g.fillStyle = '#111111'; g.fillText(String(l).slice(0, 24), 10, y + 14)
    g.fillStyle = '#edeae4'; g.fillRect(labW, y, barW, 28)
    g.fillStyle = '#c8893a'; g.fillRect(labW, y, Math.max(2, barW * Math.min(1, c.values[i] / max)), 28)
    g.fillStyle = '#111111'; g.fillText(String(c.values[i]) + (c.unit === '%' ? '%' : ''), labW + barW + 12, y + 14)
  })
  const b = atob(cv.toDataURL('image/png').split(',')[1]); const data = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) data[i] = b.charCodeAt(i)
  return { data, w, h }
}
function docxSurvey(DX: any, R: Row): any[] {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, AlignmentType } = DX; const out: any[] = []
  const cell = (t: unknown, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(t), bold, size: 18, font: 'Times New Roman' })] })] })
  for (const t of R.tables as Row[]) {
    out.push(new Paragraph({ spacing: { before: 240, after: 80 }, keepNext: true, children: [new TextRun({ text: `Table ${t.id}: ${t.caption}`, bold: true, font: 'Times New Roman', size: 22 })] }))
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: (t.headers as string[]).map(h => cell(h, true)) }), ...(t.rows as any[][]).map(r => new TableRow({ children: r.map(c => cell(c)) }))] }))
    if (t.chart) { const png = chartPng(t.chart); if (png) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 }, children: [new ImageRun({ type: 'png', data: png.data, transformation: { width: 480, height: Math.round((480 * png.h) / png.w) } })] })) }
  }
  return out
}
function docxQuestionnaire(DX: any, q: Row): any[] {
  const { Paragraph, HeadingLevel } = DX
  return [new Paragraph({ text: 'APPENDIX A: QUESTIONNAIRE', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }), ...questionnaireText(q).split('\n').map(t => new Paragraph({ text: t, spacing: { after: 80 } }))]
}

const WORDS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN']
// APA lists only the sources actually cited in the text, in alphabetical order.
function citedOnly(so: Row[], se: Row[]): Row[] {
  const text = se.map(x => String(x.content ?? '')).join('\n')
  const hit = so.filter(r => {
    const sur = String(r.citation).split(',')[0].trim(); const yr = String(r.citation).match(/\((\d{4})[a-z]?\)/)?.[1]
    if (!sur || !yr) return false
    return new RegExp(sur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^()]{0,60}' + yr).test(text)
  })
  return (hit.length ? hit : so).slice().sort((a, b) => String(a.citation).localeCompare(String(b.citation)))
}
