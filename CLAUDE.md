# CLAUDE.md — Originality Assistant

## Product Intent
This is an **originality assistant** for students. It analyzes uploaded assignments and provides coaching feedback to help students fix academic-integrity issues **before** submission.

## Critical Framing Rule
Every message in the UI, every prompt template, every error message, and every piece of user-facing text MUST:
- Sound like **"understand and fix this"** — never **"reduce your similarity score"**
- Frame findings as coaching opportunities, not accusations
- Use language like "this passage may need a citation" NOT "this passage is flagged as unoriginal"
- Suggest concrete improvements, not just identify problems
- Avoid any language that implies the goal is to evade detection tools (Turnitin, etc.)

**This is non-negotiable.** If a change violates this framing, reject it regardless of technical merit.

## Architecture Notes
- LLM provider is isolated in `src/lib/llm/` — swap providers by editing only `analyzer.ts`
- Findings are stored as JSONB (not over-normalized) — this is an MVP
- Supabase handles auth, Postgres DB, and file storage
- File parsing runs server-side in API routes
