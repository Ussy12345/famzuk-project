import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import handler from './api/ai.ts'

try { process.loadEnvFile() } catch { /* no .env on Render, uses dashboard variables */ }

const app = express()
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')

app.use(express.json({ limit: '1mb' }))
app.post('/api/ai', (req, res) => {
  handler(req as any, res as any).catch((e: unknown) => { console.error(e); res.status(500).json({ error: 'Server error' }) })
})
app.use(express.static(dist))
app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')))

app.listen(Number(process.env.PORT) || 3000, () => console.log('Famzuk Projects is running'))
