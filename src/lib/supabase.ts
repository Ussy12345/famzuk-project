import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export async function callAI(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify(body) })
  const t = await r.text(); try { return JSON.parse(t) } catch { return { error: "AI service did not respond. Check that the server is running and your .env keys are set." } }
}
