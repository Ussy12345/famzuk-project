# Famzuk Projects
AI-assisted university project builder (React + TypeScript + Vite + Tailwind + Supabase + Gemini).

## Setup
1. `npm install`
2. Create a Supabase project, run `supabase/migrations/001_init.sql` in the SQL editor.
3. Copy `.env.example` to `.env`; fill in Supabase and Gemini values. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) are only read by `api/ai.ts` on the server.
4. Run `002_admin.sql` too (admin tools at /admin; set `is_admin` on your profile).
4. Run with `npx vercel dev` (serves Vite and `/api/ai`), or `npm run dev` for the UI only.
5. `npm run build`; deploy to Vercel and add the same env vars.

Model is set by `GEMINI_MODEL`.
