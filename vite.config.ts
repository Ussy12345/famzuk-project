import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// Serves /api/ai locally during `npm run dev` (on Vercel it runs as a serverless function).
function apiDev(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      server.middlewares.use('/api/ai', async (req, res) => {
        const r: any = res
        r.status = (c: number) => { res.statusCode = c; return r }
        r.json = (o: unknown) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)) }
        try {
          let raw = ''; for await (const c of req) raw += c
          const mod = await server.ssrLoadModule('/api/ai.ts')
          await mod.default({ method: req.method, headers: req.headers, body: raw ? JSON.parse(raw) : {} }, r)
        } catch (e) { console.error(e); r.status(500).json({ error: 'AI server error. Check the terminal for details.' }) }
      })
    },
  }
}
export default defineConfig({ plugins: [react(), tailwind(), apiDev()] })
