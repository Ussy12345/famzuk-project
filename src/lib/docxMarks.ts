import JSZip from 'jszip'
export type Mark = { marked: string; note: string }

// Reads lecturer comments and tracked changes from a Word file.
export async function readDocxMarks(file: File): Promise<Mark[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const parse = (x: string) => new DOMParser().parseFromString(x, 'application/xml')
  const docXml = await zip.file('word/document.xml')?.async('string'); if (!docXml) return []
  const doc = parse(docXml)
  const cXml = await zip.file('word/comments.xml')?.async('string')
  const txt = (el: Element, tag: string) => Array.from(el.getElementsByTagName(tag)).map(t => t.textContent ?? '').join('')
  const out: Mark[] = []

  const comments = new Map<string, string>()
  if (cXml) for (const c of Array.from(parse(cXml).getElementsByTagName('w:comment'))) comments.set(c.getAttribute('w:id') ?? '', txt(c, 'w:t').trim())
  const open = new Set<string>(); const anchors = new Map<string, string>()
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    const n = el.nodeName
    if (n === 'w:commentRangeStart') open.add(el.getAttribute('w:id') ?? '')
    else if (n === 'w:commentRangeEnd') open.delete(el.getAttribute('w:id') ?? '')
    else if (n === 'w:t' || n === 'w:delText') for (const id of open) anchors.set(id, (anchors.get(id) ?? '') + (el.textContent ?? ''))
  }
  comments.forEach((note, id) => { if (note) out.push({ marked: (anchors.get(id) ?? '').trim().slice(0, 300), note }) })

  for (const d of Array.from(doc.getElementsByTagName('w:del'))) {
    const del = txt(d, 'w:delText').trim(); if (!del) continue
    const nx = d.nextElementSibling; const ins = nx && nx.nodeName === 'w:ins' ? txt(nx, 'w:t').trim() : ''
    out.push({ marked: del.slice(0, 300), note: ins ? `Replace with: "${ins}"` : 'Delete this text.' })
  }
  for (const i of Array.from(doc.getElementsByTagName('w:ins'))) {
    const ins = txt(i, 'w:t').trim(); if (!ins) continue
    const prev = i.previousElementSibling; if (prev && prev.nodeName === 'w:del') continue
    let p: Element | null = i; while (p && p.nodeName !== 'w:p') p = p.parentElement
    out.push({ marked: p ? txt(p, 'w:t').trim().slice(0, 160) : '', note: `Insert: "${ins}"` })
  }
  return out.slice(0, 80)
}
