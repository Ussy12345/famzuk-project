import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import handler from './api/ai.ts'

try { process.loadEnvFile() } catch { /* no .env on Render, uses dashboard variables */ }

const app = express()
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')

app.use(express.json({ limit: '12mb' }))

app.get('/api/health', (_req, res) => {
  const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'GEMINI_MODEL']
  res.json({ ok: true, missing: need.filter(k => !process.env[k]), backupSearch: !!process.env.TAVILY_API_KEY })
})

app.post('/api/ai', (req, res) => {
  handler(req as any, res as any).catch((e: unknown) => {
    console.error('AI crash:', e)
    if (!res.headersSent) res.status(500).json({ error: 'Server error. Please try again.' })
  })
})
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }) })

app.use(express.static(dist))
app.use((_req, res) => { res.sendFile(path.join(dist, 'index.html')) })

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err)
  res.status(err?.status === 413 ? 413 : 500).json({ error: err?.status === 413 ? 'The photo is too large. Please use a smaller photo.' : 'Server error. Please try again.' })
})

app.listen(Number(process.env.PORT) || 3000, () => console.log('Famzuk Projects is running'))
