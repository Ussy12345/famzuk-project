import './net'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

type Opts = { json?: boolean; search?: boolean }

// Central Gemini service layer (server-side only). search=true turns on Google Search grounding.
async function gemini(prompt: string, system: string, o: Opts = {}): Promise<string> {
  const models = [process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', process.env.GEMINI_FALLBACK_MODEL, process.env.GEMINI_FALLBACK_MODEL_2 || 'gemini-flash-latest'].filter(Boolean) as string[]
  let last = ''
  for (let i = 0; i < 6; i++) {
    const model = models[i % models.length]
    let r: Response
    try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      signal: AbortSignal.timeout(o.search ? 120000 : 60000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY as string },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(o.search ? { tools: [{ google_search: {} }] } : {}),
        ...(o.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    }) } catch (e) { last = 'network: ' + String((e as any)?.cause?.code || e); console.warn(`Gemini retry ${i + 1}/6 -> ${last}`); await new Promise(res => setTimeout(res, 4000 * (i + 1))); continue }
    if (r.ok) {
      const j = await r.json()
      const t = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
      if (t.trim()) return t
      last = `empty reply from ${model}`
    } else {
      const body = await r.text()
      last = `${r.status} ${model} search=${!!o.search}: ${body.slice(0, 220).replace(/\s+/g, ' ')}`
      if (r.status === 429 && o.search && /quota|RESOURCE_EXHAUSTED/i.test(body)) { if (process.env.TAVILY_API_KEY) { const ctx = await webContext(prompt); o.search = false; return gemini(ctx ? prompt + '\n\nWEB SEARCH RESULTS (use these for current facts and structure, do not invent anything beyond them):\n' + ctx : prompt, system, o) } if (process.env.REQUIRE_SEARCH !== 'false') throw Object.assign(new Error('search_quota'), { code: 'search_quota' }); console.warn('Search quota exhausted; continuing without Google Search'); o.search = false; return gemini(prompt, system, o) }
      if (![429, 500, 502, 503, 504].includes(r.status)) throw new Error(`gemini_${last}`)
      const m = body.match(/"retryDelay":\s*"(\d+)/)
      var wait = Math.min(25, m ? Number(m[1]) + 1 : 3 * (i + 1))
    }
    console.warn(`Gemini retry ${i + 1}/6 -> ${last}`)
    await new Promise(res => setTimeout(res, (wait || 3) * 1000))
  }
  throw Object.assign(new Error('busy: ' + last), { code: 429 })
}

async function webContext(prompt: string): Promise<string> {
  const topic = prompt.match(/Topic: (.+)/)?.[1] ?? ''
  const heading = prompt.match(/section "(.+?)"/)?.[1] ?? 'structure of project chapters'
  try {
    const r = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.TAVILY_API_KEY}` }, body: JSON.stringify({ query: `${topic} ${heading}`.slice(0, 300), max_results: 6 }), signal: AbortSignal.timeout(30000) })
    if (!r.ok) return ''
    const j = await r.json()
    return (j.results ?? []).map((x: any) => `- ${x.title} (${x.url}): ${String(x.content).slice(0, 400)}`).join('\n')
  } catch { return '' }
}

function clean(t: string): string {
  return t.replace(/\r/g, '').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[*-]\s+/gm, '• ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/\*(?!\s)([^*\n]+?)\*/g, '$1').replace(/`/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

const RULES = `Write in simple, clear academic English. Use plain text only: no markdown, no asterisks, no # headings, no bold or italics. Do not repeat the section title. Write normal paragraphs. NEVER invent references, authors, DOIs, statistics or research results. If real data is missing write "[Student research data required here]".`

// Checks a reference line's link. Dead and DOI links are dropped.
async function checkLink(line: string): Promise<'verified' | 'unverified' | 'dead'> {
  const url = line.match(/https?:\/\/[^\s<>)\]]+/)?.[0]?.replace(/[.,;]+$/, '')
  if (!url || /doi\.org/i.test(url)) return 'dead'
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 FamzukProjects' } })
    if ([401, 403, 429].includes(r.status)) return 'unverified'
    if (!r.ok) return 'dead'
    const body = (await r.text()).slice(0, 300000).toLowerCase()
    const surname = line.split(',')[0].trim().toLowerCase()
    return surname.length > 1 && body.includes(surname) ? 'verified' : 'unverified'
  } catch { return 'dead' }
}

function parseRefs(text: string): string[] {
  return text.split('\n').map(l => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(l => l.length > 40 && /\(20(2[0-5])\)/.test(l) && /https?:\/\//.test(l))
}

function apaName(n: string) { const p = n.replace(/\./g, '').trim().split(/\s+/); if (p.length < 2) return n; return `${p[p.length - 1]}, ${p.slice(0, -1).map(x => x[0].toUpperCase() + '.').join(' ')}` }
function toApa(w: any): string | null {
  const auth: string[] = (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean).slice(0, 20).map(apaName)
  const loc = w.primary_location ?? {}
  const url = [w.open_access?.oa_url, loc.landing_page_url].find((u: string) => u && !/doi\.org/i.test(u))
  const title = String(w.title ?? '').replace(/<[^>]+>/g, '').replace(/\.$/, '').trim()
  if (!auth.length || !title || !w.publication_year || !url) return null
  const who = auth.length === 1 ? auth[0] : auth.slice(0, -1).join(', ') + ', & ' + auth[auth.length - 1]
  const b = w.biblio ?? {}, src = loc.source?.display_name
  const vol = b.volume ? `, ${b.volume}` : '', iss = b.issue ? `(${b.issue})` : '', pg = b.first_page ? `, ${b.first_page}${b.last_page && b.last_page !== b.first_page ? '-' + b.last_page : ''}` : ''
  return `${who} (${w.publication_year}). ${title}. ${src ? src + vol + iss + pg + '. ' : ''}${url}`
}
async function findReferences(db: any, project: Record<string, any>) {
  const { data: have } = await db.from('project_sources').select('citation').eq('project_id', project.id)
  const known = new Set((have ?? []).map((s: any) => s.citation))
  if (known.size >= 30) return { added: 0, verified: 0 }
  let queries: string[] = [project.topic]
  try {
    const t = await gemini(`Topic: ${project.topic}\nCourse: ${project.course_name}\nGive 6 short, different academic search queries (3-6 words each) for finding peer-reviewed papers on this topic. Reply ONLY with a JSON array of strings.`, 'You are a research librarian.', { json: true })
    const q = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1))
    if (Array.isArray(q) && q.length) queries = [project.topic, ...q.map(String)].slice(0, 7)
  } catch { /* use the topic alone */ }
  const pools: any[][] = await Promise.all(queries.map(q => fetch(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&filter=from_publication_date:2020-01-01,to_publication_date:2025-12-31,type:article&per-page=15&mailto=projects@famzuk.app`, { signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.json() : { results: [] }).then(j => j.results ?? []).catch(() => [])))
  const seen = new Set<string>(); const lines: string[] = []
  for (let i = 0; i < 15; i++) for (const pool of pools) { const w = pool[i]; if (!w) continue; const key = String(w.title).toLowerCase(); const line = toApa(w); if (line && !seen.has(key) && !known.has(line)) { seen.add(key); lines.push(line) } }
  const pick = lines.slice(0, 30 - known.size)
  const results = await Promise.all(pick.map(checkLink))
  const rows = pick.map((l, i) => ({ project_id: project.id, citation: l, provenance: results[i] === 'verified' ? 'verified' : 'needs_verification' }))
  if (rows.length) await db.from('project_sources').insert(rows)
  return { added: rows.length, verified: rows.filter(r => r.provenance === 'verified').length }
}

async function planProject(db: any, project: Record<string, any>) {
  const o: Opts = { search: true }
  const prompt = `Student project:\nTopic: ${project.topic}\nCourse: ${project.course_name}\nLevel: ${project.level}\nInstitution: ${project.institution}\nProject type: ${project.project_type}\nTarget length: about ${project.target_pages} pages.\n\nUse Google Search to confirm how real ${project.course_name} ${project.level} projects on this kind of topic are structured, which headings and methods are standard, and what the usual problem, aim and objectives are. Then reply with ONLY one JSON object, no markdown:\n{"memory":{"problem":"","aim":"","objectives":[],"researchQuestions":[],"targetUsers":"","proposedSolution":"","methodology":"","technologies":[],"features":[],"facts":[],"assumptions":[]},"chapters":[{"title":"Introduction","sections":["Background","Statement of the Problem","Objectives","Significance","Scope"]}]}\nStructure rules (follow this style exactly): five chapters titled Introduction; Literature Review; Materials and Methods (or Research Methodology, or System Analysis and Design, whichever fits the course); Results and Discussion (or Implementation and Testing); Conclusion and Recommendations. Chapter 1 sections are exactly: Background, Statement of the Problem, Objectives, Significance, Scope. Chapter 2 has 5 to 7 headings that name the real subject of THIS topic (example for a study on antioxidants in Momordica charantia: Overview of Medicinal Plants, Botanical Profile of Momordica charantia, Phytochemical Constituents, Oxidative Stress and Free Radicals, Antioxidant Mechanisms, Plant Extraction Principles). Chapter 3 lists the real methods or procedures for this topic. Chapter 4 has 4 to 6 result headings ending with Discussion. Chapter 5 sections: Summary, Conclusion, Recommendations. Headings are short and have no numbers. Never invent statistics or results.`
  let plan: any
  for (let i = 0; i < 2 && !plan; i++) {
    try {
      const t = await gemini(prompt, 'You are an experienced university project supervisor. Reply with JSON only.', o)
      const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))
      if (Array.isArray(j.chapters) && j.chapters.length >= 3) plan = j
    } catch (e) { console.warn('plan retry', e) }
  }
  if (!plan) throw new Error('plan_failed')
  await db.from('project_chapters').delete().eq('project_id', project.id)
  await db.from('project_memory').upsert({ project_id: project.id, data: plan.memory ?? {} })
  let pos = 0
  for (const [i, c] of plan.chapters.entries()) {
    const { data: ch } = await db.from('project_chapters').insert({ project_id: project.id, position: i + 1, title: String(c.title) }).select().single()
    const rows = (c.sections as string[]).map(h => ({ project_id: project.id, chapter_id: ch!.id, position: ++pos, heading: String(h).replace(/^[\d.\s]+/, '') }))
    const { data: secs } = await db.from('project_sections').insert(rows).select('id')
    await db.from('project_generation_jobs').insert((secs ?? []).map((x: any) => ({ project_id: project.id, chapter_id: ch!.id, section_id: x.id })))
  }
  await db.from('projects').update({ status: 'ready' }).eq('id', project.id)
  return !!o.search || !!process.env.TAVILY_API_KEY
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = createClient((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const netErr = (e: any) => /fetch|retryable|network|timeout/i.test(String(e?.name) + String(e?.message))
  const { data: u, error: ue } = await db.auth.getUser((req.headers.authorization || '').replace('Bearer ', ''))
  if (!u?.user) return netErr(ue) ? res.status(503).json({ error: 'Network problem reaching the database. Please try again.' }) : res.status(401).json({ error: 'Unauthorized' })
  const { action, projectId, sectionId } = req.body ?? {}
  const { data: project, error: pe } = await db.from('projects').select('*').eq('id', projectId).eq('user_id', u.user.id).single()
  if (!project) return pe && pe.code !== 'PGRST116' ? res.status(503).json({ error: 'Network problem reaching the database. Please try again.' }) : res.status(404).json({ error: 'Project not found' })
  try {
    if (action === 'interview') {
      const { data: qa } = await db.from('project_questions').select('question,answer').eq('project_id', projectId).order('position')
      const { data: course } = await db.from('course_profiles').select('*').eq('id', project.course_id).single()
      const out = await gemini(
        `Project: ${JSON.stringify(project)}\nCourse profile: ${JSON.stringify(course)}\nQ&A so far: ${JSON.stringify(qa)}\nIf you have enough information (3-7 questions total, usually 5), reply exactly DONE. Otherwise reply with ONE next question only.`,
        'You interview a university student to build a project memory. ' + RULES)
      if (out.trim() === 'DONE') {
        const mem = await gemini(`Q&A: ${JSON.stringify(qa)}\nProject: ${JSON.stringify(project)}`, 'Return ONLY JSON with keys: problem, aim, objectives[], researchQuestions[], targetUsers, proposedSolution, methodology, technologies[], features[], facts[], assumptions[].', { json: true })
        await db.from('project_memory').upsert({ project_id: projectId, data: JSON.parse(mem.replace(/```json|```/g, '')) })
        await db.from('projects').update({ status: 'ready' }).eq('id', projectId)
        return res.json({ done: true })
      }
      await db.from('project_questions').insert({ project_id: projectId, position: (qa?.length ?? 0) + 1, question: out.trim() })
      return res.json({ done: false, question: out.trim() })
    }
    if (action === 'plan') { const searched = await planProject(db, project); return res.json({ ok: true, searched }) }
    if (action === 'find_references') return res.json({ ok: true, ...(await findReferences(db, project)) })
    if (action === 'generate_section') {
      const { data: s } = await db.from('project_sections').select('*').eq('id', sectionId).eq('project_id', projectId).single()
      const { data: mem } = await db.from('project_memory').select('data').eq('project_id', projectId).single()
      const { data: src } = await db.from('project_sources').select('citation').eq('project_id', projectId).neq('provenance', 'ai_generated').limit(40)
      const refs = (src ?? []).map((x: any) => x.citation.replace(/https?:\/\/\S+/g, '').trim())
      const { count: nSec } = await db.from('project_sections').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
      const perSection = Math.round((project.target_pages * 300) / Math.max(1, nSec ?? 40))
      const eight = /^(background( of the study)?|statement of the problem)$/i.test(s.heading)
      const wantsSearch = true
      await db.from('project_sections').update({ status: 'generating' }).eq('id', sectionId)
      try {
        const cite = refs.length
          ? `REFERENCE LIST (cite ONLY from this list, never anything else):\n${refs.join('\n')}\nIn-text citations use APA style: (Author, Year) for 1 author, (Author & Author, Year) for 2 authors, and (Author et al., Year) for 3 or more authors.`
          : 'No references are available, so do not include in-text citations.'
        const shape = eight
          ? 'Write exactly 8 paragraphs, each about 100 to 140 words. Every paragraph must end with an in-text citation from the reference list.'
          : `Target about ${perSection} words. Cite from the reference list only where a statement truly relies on a source.`
        const text = await gemini(
          `Project memory: ${JSON.stringify(mem?.data)}\nTopic: ${project.topic}\n${cite}\nWrite section "${s.heading}". ${shape}${wantsSearch ? ' Use Google Search for current facts; do not state any statistic you did not find.' : ''}`,
          RULES, { search: wantsSearch })
        await db.from('project_sections').update({ content: clean(text), status: 'completed', updated_at: new Date().toISOString() }).eq('id', sectionId)
        return res.json({ ok: true })
      } catch (e) {
        await db.from('project_sections').update({ status: 'failed' }).eq('id', sectionId)
        throw e
      }
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    console.error('AI error:', e)
    if ((e as any)?.code === 'search_quota') return res.status(429).json({ error: 'Google Search is out of quota. Turn on billing for your Gemini key, then try again.' })
    const code = (e as { code?: number }).code
    return res.status(code === 429 ? 429 : 500).json({ error: code === 429 ? 'Rate limit reached. We will retry shortly.' : 'Something went wrong. We will retry automatically.' })
  }
}
