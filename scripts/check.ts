import '../api/net'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
try { process.loadEnvFile() } catch { console.log('No .env file found') }
const env = process.env
const sb = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
async function step(name: string, fn: () => Promise<string>) {
  try { console.log('OK    ', name, '-', await fn()) } catch (e: any) { console.log('FAIL  ', name, '-', String(e?.cause?.code || e?.message || e).slice(0, 300)) }
}
const get = (u: string, h: Record<string, string> = {}) => fetch(u, { headers: h, signal: AbortSignal.timeout(20000) })
const gem = async (body: object) => {
  const m = env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY || '' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} (${m}) ${t.replace(/\s+/g, ' ').slice(0, 200)}`)
  return `model ${m} replied`
}
const ask = { contents: [{ parts: [{ text: 'Say hello.' }] }] }
await step('1 Internet (google.com)', async () => { const r = await get('https://www.google.com'); return 'HTTP ' + r.status })
await step('2 Supabase reachable', async () => { if (!sb) throw new Error('SUPABASE_URL missing in .env'); const r = await get(sb + '/auth/v1/health', { apikey: env.VITE_SUPABASE_ANON_KEY || '' }); return 'HTTP ' + r.status })
await step('3 Supabase service key + tables', async () => { const k = env.SUPABASE_SERVICE_ROLE_KEY || ''; if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing'); const r = await get(sb + '/rest/v1/course_profiles?select=id&limit=1', { apikey: k, Authorization: 'Bearer ' + k }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 150)); return 'HTTP 200' })
await step('4 Gemini (no search)', () => gem(ask))
await step('5 Gemini WITH Google Search', () => gem({ ...ask, tools: [{ google_search: {} }] }))
await step('6 OpenAlex (references)', async () => { const r = await get('https://api.openalex.org/works?per-page=1'); return 'HTTP ' + r.status })
