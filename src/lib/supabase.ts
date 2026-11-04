import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

async function post(body: Record<string, unknown>, token?: string) {
  const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  const t = await r.text()
  let j: any
  try { j = JSON.parse(t) } catch { j = { error: `The server sent an unexpected reply (HTTP ${r.status}). It may be waking up, so please wait a moment and retry.` } }
  return { status: r.status, j }
}

export async function callAI(body: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getSession()
    let res = await post(body, data.session?.access_token)
    if (res.status === 401 || res.status === 503) {
      await new Promise(x => setTimeout(x, 1500))
      const ref = await supabase.auth.refreshSession()
      res = await post(body, ref.data.session?.access_token)
    }
    if (res.status === 401) return { error: 'Your session expired. Please log in again.', auth: true }
    return res.j
  } catch {
    return { error: 'No internet connection. Please check your network. We will try again.', offline: true }
  }
}
