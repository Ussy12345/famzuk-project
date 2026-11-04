import { supabase } from './supabase'
import { clean } from './clean'
type Row = Record<string, any>
async function collect(id: string) {
  const q = (t: string) => supabase.from(t).select('*').eq('project_id', id)
  const [p, ch, se, so] = await Promise.all([supabase.from('projects').select('*').eq('id', id).single(), q('project_chapters').order('position'), q('project_sections').order('position'), q('project_sources')])
  return { p: p.data as Row, ch: (ch.data ?? []) as Row[], se: (se.data ?? []) as Row[], so: (so.data ?? []) as Row[] }
}
const label = (s: Row) => (s.provenance === 'verified' ? '' : ` [${String(s.provenance).replace('_', ' ')}]`)
export async function exportPdf(id: string) {
  const { jsPDF } = await import('jspdf'); const { p, ch, se, so } = await collect(id)
  const d = new jsPDF({ unit: 'pt', format: 'a4' }); const W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(), m = 72; let y = m
  const add = (t: string, size: number, bold = false, gap = 8) => { d.setFont('times', bold ? 'bold' : 'normal'); d.setFontSize(size); for (const l of d.splitTextToSize(t, W - 2 * m)) { if (y > H - m) { d.addPage(); y = m } d.text(l, m, y); y += size * 1.5 } y += gap }
  d.setFont('times', 'bold'); d.setFontSize(20); d.text(d.splitTextToSize(String(p.topic).toUpperCase(), W - 2 * m), W / 2, 220, { align: 'center' })
  d.setFont('times', 'normal'); d.setFontSize(13); d.text([`A ${p.project_type} in ${p.course_name}`, p.institution, p.level], W / 2, 360, { align: 'center' }); d.addPage(); y = m
  ch.forEach((c, i) => { if (i) { d.addPage(); y = m } add(`CHAPTER ${i + 1}`, 14, true, 0); add(String(c.title).toUpperCase(), 14, true, 12)
    se.filter(s => s.chapter_id === c.id).forEach((s, j) => { add(`${i + 1}.${j + 1} ${s.heading}`, 12, true, 4); add(clean(s.content || '[Not yet written]'), 12) }) })
  d.addPage(); y = m; add('REFERENCES', 14, true, 12); so.forEach(s => add(s.citation + label(s), 12, false, 4))
  const n = d.getNumberOfPages(); for (let i = 2; i <= n; i++) { d.setPage(i); d.setFontSize(10); d.text(String(i - 1), W / 2, H - 36, { align: 'center' }) }
  d.save(`${String(p.topic).slice(0, 40)}.pdf`)
}
export async function exportDocx(id: string) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, Footer, PageNumber, AlignmentType } = await import('docx'); const { p, ch, se, so } = await collect(id)
  const kids: any[] = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 3000 }, children: [new TextRun({ text: String(p.topic).toUpperCase(), bold: true, size: 40 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(`${p.project_type} — ${p.course_name}, ${p.institution}`)] })]
  ch.forEach((c, i) => { kids.push(new Paragraph({ text: `CHAPTER ${i + 1}: ${c.title}`.toUpperCase(), heading: HeadingLevel.HEADING_1, pageBreakBefore: true }))
    se.filter(s => s.chapter_id === c.id).forEach((s, j) => { kids.push(new Paragraph({ text: `${i + 1}.${j + 1} ${s.heading}`, heading: HeadingLevel.HEADING_2 }))
      clean(String(s.content || '[Not yet written]')).split(/\n+/).forEach(t => kids.push(new Paragraph({ spacing: { after: 160, line: 360 }, children: [new TextRun({ text: t, font: 'Times New Roman', size: 24 })] }))) }) })
  kids.push(new Paragraph({ text: 'REFERENCES', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }), ...so.map(s => new Paragraph({ text: s.citation + label(s) })))
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
