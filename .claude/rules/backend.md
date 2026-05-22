---
paths:
  - "src/app/api/**"
  - "src/lib/supabase*"
  - "supabase/**"
  - "scripts/**"
---

# Backend Development Rules

## Database (Supabase)
- ALWAYS enable Row Level Security on every table
- Create RLS policies for SELECT, INSERT, UPDATE, DELETE
- Add indexes on columns used in WHERE, ORDER BY, and JOIN clauses
- Use foreign keys with ON DELETE CASCADE where appropriate
- Never skip RLS - security first

## API Routes
- Validate all inputs using Zod schemas before processing
- Always check authentication: verify user session exists
- Return meaningful error messages with appropriate HTTP status codes
- Use `.limit()` on all list queries

## Query Patterns
- Use Supabase joins instead of N+1 query loops
- Use `unstable_cache` from Next.js for rarely-changing data
- Always handle errors from Supabase responses

## Standalone Node scripts (`scripts/**`)
- `tsx` does NOT auto-load `.env*` files (unlike `next dev`).
  Standalone Node scripts under `scripts/**` must load env vars
  explicitly — either via tsx's `--env-file=.env.local` flag in
  the npm script entry, or via `import 'dotenv/config'` at the
  top of the script file.
- Prefer the `--env-file` flag (Node 20+ native, no extra
  dependency) unless the script needs runtime-conditional
  env loading.
- Validate env vars with Zod before any side effects (DB
  writes, network calls). Fail-fast with clear messages and
  exit code 1.

## Security
- Never hardcode secrets in source code
- Use environment variables for all credentials
- Validate and sanitize all user input
- Use parameterized queries (Supabase handles this)
