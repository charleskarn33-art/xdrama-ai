# XDrama AI Studio

An AI Operating System for Filmmakers — turn a script, a prompt, or an uploaded asset into a finished movie, without ever touching the AI pipeline underneath.

Full architecture, audit, and module-by-module roadmap: [`docs/00-technical-audit-and-roadmap.md`](docs/00-technical-audit-and-roadmap.md).
Per-module write-ups: [`docs/01-module-1-foundation.md`](docs/01-module-1-foundation.md), [`docs/02-module-2-auth-core-schema.md`](docs/02-module-2-auth-core-schema.md), [`docs/03-module-3-projects-dashboard.md`](docs/03-module-3-projects-dashboard.md), [`docs/04-module-4-story-bible.md`](docs/04-module-4-story-bible.md), [`docs/05-module-5-script-studio.md`](docs/05-module-5-script-studio.md).

## Repository layout

```
apps/
  web/                  Next.js 16 app (frontend) — deployed to Vercel
services/
  ai-orchestrator/       FastAPI service — the only thing that talks to ComfyUI/GPU render nodes
supabase/
  migrations/             SQL migrations (source of truth for the database schema)
  config.toml             Supabase CLI project config
infra/
  nginx/                  Reverse proxy config for AI infrastructure
docs/                     Architecture, audits, and per-module documentation
docker-compose.yml         Local dev / GPU render-node infrastructure (not the Next.js app)
```

## Prerequisites

- Node.js 22+, [pnpm](https://pnpm.io) 10+
- Python 3.11+
- Docker (for `ai-orchestrator` + Redis locally)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase ...`) and a Supabase project

## Getting started

### 1. Frontend (`apps/web`)

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in your Supabase project's URL + anon key
pnpm --filter web dev
```

Runs at http://localhost:3000. Health check: `GET /api/health`.

### 2. AI orchestration service (`services/ai-orchestrator`)

```bash
cd services/ai-orchestrator
cp .env.example .env   # fill in SUPABASE_JWT_SECRET from Project Settings > API
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Runs at http://localhost:8000. Health check: `GET /health`. Or via Docker:

```bash
docker compose up ai-orchestrator redis
```

### 3. Database (Supabase)

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*.sql
npx supabase gen types typescript --linked > apps/web/src/lib/supabase/types.ts
```

To test migrations (including RLS/RBAC policies) against a real local Postgres before pushing anywhere, see [`supabase/tests/README.md`](supabase/tests/README.md):

```bash
./supabase/tests/run_tests.sh
```

## Development workflow

This project ships one module at a time (see the roadmap doc). Each module lands with its own migration, API, UI, tests, and docs — never partial, never speculative.

Common commands (from `apps/web`):

```bash
pnpm lint            # ESLint
pnpm typecheck       # tsc --noEmit
pnpm test            # Vitest
pnpm format          # Prettier
pnpm build            # Production build
```

From `services/ai-orchestrator`:

```bash
ruff check .
mypy app
pytest
```

## Security baseline

Every table ships with RLS enabled from its first migration. The FastAPI service independently verifies Supabase JWTs — it never trusts the frontend. See [`docs/00-technical-audit-and-roadmap.md`](docs/00-technical-audit-and-roadmap.md#3-security-audit) for the full baseline.
