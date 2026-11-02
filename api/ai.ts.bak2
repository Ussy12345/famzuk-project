import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Central Gemini service layer (server-side only).
async function gemini(prompt: string, system: string, json = false): Promise<string> {
  const primary = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const backup = process.env.GEMINI_FALLBACK_MODEL
  for (let i = 0; i < 4; i++) {
    const model = i >= 2 && backup ? backup : primary
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY as string },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    })
    if (r.ok) {
      const j = await r.json()
      const t = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
      if (t.trim()) return t
    } else if (![429, 500, 502, 503, 504].includes(r.status)) {
      throw new Error(`gemini_${r.status} model=${model}`)
    }
    console.warn(`Gemini retry ${i + 1}/4 (${model})`)
    await new Promise(res => setTimeout(res, 2000 * 2 ** i))
  }
  throw Object.assign(new Error('busy'), { code: 429 })
}

function clean(t: string): string {
  return t.replace(/\r/g, '').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[*-]\s+/gm, '• ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/\*(?!\s)([^*\n]+?)\*/g, '$1').replace(/`/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

const RULES = `Write in simple, clear academic English. Use plain text only: no markdown, no asterisks, no # headings, no bold or italics. Do not repeat the section title. Write normal paragraphs. NEVER invent references, authors, DOIs, statistics or research results. If real data is missing write "[Student research data required here]".`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = createClient((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.auth.getUser((req.headers.authorization || '').replace('Bearer ', ''))
  if (!u.user) return res.status(401).json({ error: 'Unauthorized' })
  const { action, projectId, sectionId } = req.body ?? {}
  const { data: project } = await db.from('projects').select('*').eq('id', projectId).eq('user_id', u.user.id).single()
  if (!project) return res.status(404).json({ error: 'Project not found' })
  try {
    if (action === 'interview') {
      const { data: qa } = await db.from('project_questions').select('question,answer').eq('project_id', projectId).order('position')
      const { data: course } = await db.from('course_profiles').select('*').eq('id', project.course_id).single()
      const out = await gemini(
        `Project: ${JSON.stringify(project)}\nCourse profile: ${JSON.stringify(course)}\nQ&A so far: ${JSON.stringify(qa)}\nIf you have enough information (3-7 questions total, usually 5), reply exactly DONE. Otherwise reply with ONE next question only.`,
        'You interview a university student to build a project memory. ' + RULES)
      if (out.trim() === 'DONE') {
        const mem = await gemini(`Q&A: ${JSON.stringify(qa)}\nProject: ${JSON.stringify(project)}`, 'Return ONLY JSON with keys: problem, aim, objectives[], researchQuestions[], targetUsers, proposedSolution, methodology, technologies[], features[], facts[], assumptions[].', true)
        await db.from('project_memory').upsert({ project_id: projectId, data: JSON.parse(mem.replace(/```json|```/g, '')) })
        await db.from('projects').update({ status: 'ready' }).eq('id', projectId)
        return res.json({ done: true })
      }
      await db.from('project_questions').insert({ project_id: projectId, position: (qa?.length ?? 0) + 1, question: out.trim() })
      return res.json({ done: false, question: out.trim() })
    }
    if (action === 'generate_section') {
      const { data: s } = await db.from('project_sections').select('*').eq('id', sectionId).eq('project_id', projectId).single()
      const { data: mem } = await db.from('project_memory').select('data').eq('project_id', projectId).single()
      await db.from('project_sections').update({ status: 'generating' }).eq('id', sectionId)
      try {
        const text = await gemini(`Project memory: ${JSON.stringify(mem?.data)}\nTopic: ${project.topic}\nWrite section "${s.heading}". Target about ${Math.round((project.target_pages * 300) / 40)} words.`, RULES)
        await db.from('project_sections').update({ content: clean(text), status: 'completed', updated_at: new Date().toISOString() }).eq('id', sectionId)
        return res.json({ ok: true })
      } catch (e) {
        await db.from('project_sections').update({ status: 'failed' }).eq('id', sectionId)
        throw e
      }
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    console.error("AI error:", e)
    const code = (e as { code?: number }).code
    return res.status(code === 429 ? 429 : 500).json({ error: code === 429 ? 'Rate limit reached. We will retry shortly.' : 'Something went wrong. We will retry automatically.' })
  }
}
