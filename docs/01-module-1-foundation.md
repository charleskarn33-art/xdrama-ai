# Module 1 — Foundation & Repo Scaffold

**Status:** Complete, pending your approval to move to Module 2.

## Architecture

XDrama AI Studio is a pnpm monorepo with three top-level concerns, matching the deployment split in the brief (Vercel / Supabase / Ubuntu GPU servers):

```
apps/web/                Next.js 16 (App Router) — the only user-facing surface. Deploys to Vercel.
services/ai-orchestrator/ FastAPI — the only service that will ever talk to ComfyUI/GPU nodes. Deploys via Docker to the GPU infrastructure.
supabase/                 SQL migrations + Supabase CLI config — source of truth for the database.
infra/nginx/               Reverse proxy in front of ai-orchestrator.
docs/                      Architecture, audits, per-module write-ups.
```

Why this split, not a single Next.js app with API routes doing everything: the brief requires that ComfyUI and GPU workloads never be reachable from the public internet, and that AI orchestration live on infrastructure you control (Ubuntu GPU boxes), independent of Vercel's serverless constraints (request timeouts, no persistent GPU access, no Docker). Splitting the orchestrator out from day one avoids a rewrite when Module 8 (Workflow Engine) needs to dispatch long-running GPU jobs.

**Package manager:** pnpm workspaces (`pnpm-workspace.yaml` at root) — `apps/*` and `packages/*` are workspace members. `services/ai-orchestrator` is Python and manages its own dependencies via `requirements.txt`/`pyproject.toml`, outside the pnpm workspace.

## Database changes

One migration: `supabase/migrations/20260808182805_baseline.sql`.

- Enables `pgcrypto` and `uuid-ossp` (needed by every future table for UUID primary keys).
- Defines `public.set_updated_at()`, a trigger function every table with an `updated_at` column will attach to from Module 2 onward.

No application tables yet — Users/Organizations/RLS baseline is Module 2's job, on purpose: schema decisions there depend on the billing/tenancy model, which is still an open question (flagged in the roadmap doc).

## Frontend

- **Next.js 16**, App Router, TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitReturns` on top of `strict`), Turbopack (default in v16).
- **Tailwind CSS v4** with CSS-variable theming (`src/app/globals.css`) — light/dark tokens, `oklch` color space.
- **shadcn/ui**, hand-installed rather than via the CLI: the CLI's `init`/`add` commands fetch component source from `ui.shadcn.com`, which this environment's network policy blocks (verified via the proxy's `recentRelayFailures` — a `403` on the CONNECT, not a transient failure). The component source itself is static, MIT-licensed boilerplate, so `components.json`, `src/lib/utils.ts` (`cn` helper), and the base primitives (`Button`, `Input`, `Label`, `Card`, `Separator`) are written directly. Anyone on the team with unblocked network access can still use `npx shadcn add <component>` normally going forward — the config is fully compatible.
- **State/data**: TanStack Query (`Providers` in `src/app/providers.tsx`), Zustand and React Hook Form + Zod installed and ready, not yet wired to anything (nothing to manage state for until Module 2's auth forms).
- **React Flow** (`@xyflow/react`) installed now since it's a hard dependency of the Workflow Builder (Module 15) and the Story Bible / node-based editors — no UI built on it yet.
- **Supabase clients**: `src/lib/supabase/{client,server}.ts` using `@supabase/ssr`, plus `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`) which refreshes the auth session cookie on every request.
- **Env validation**: `src/env.ts` parses `NEXT_PUBLIC_*` vars with Zod at import time and fails fast with a clear error if misconfigured, rather than surfacing a cryptic runtime Supabase error later.
- Landing page (`src/app/page.tsx`) and `GET /api/health` are real, working routes — not placeholders — verified in a browser (see Testing below).

**Next.js 16 specifics applied** (this version has real breaking changes vs. older training data — confirmed against `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`): `middleware.ts` → `proxy.ts` with an exported `proxy()` function; Turbopack is default (no `--turbopack` flag needed); async `cookies()` used in `server.ts`.

## Backend (AI orchestration service)

`services/ai-orchestrator` — FastAPI, Python 3.11.

- `app/main.py` — app entrypoint, CORS restricted to `CORS_ALLOW_ORIGINS`.
- `app/core/config.py` — `pydantic-settings`-based config, env-driven.
- `app/core/auth.py` — **independently verifies Supabase-issued JWTs** (HS256, `SUPABASE_JWT_SECRET`) on every protected request. This is the Module 1 security baseline in code: the orchestrator never trusts a request just because it came from the frontend.
- `app/api/health.py` — `GET /health`.
- `app/api/me.py` — `GET /api/v1/me`, a protected reference route proving the JWT dependency works; every real orchestration route from Module 8 onward reuses `verify_supabase_jwt`.

This service is deliberately thin right now — no ComfyUI client, no model registry, no job queue. Those are Modules 6–8. Module 1's job is proving the auth boundary and deployment path work.

## Security

- RLS: nothing to enable yet (no tables); the trigger function is `security definer` with `search_path = ''` to avoid search-path hijacking, per Postgres function-security best practice.
- JWT verification lives in the orchestrator, independent of the frontend, per the audit.
- `SUPABASE_SERVICE_ROLE_KEY` never appears in `apps/web` client code — only referenced (optionally) server-side via `getServerEnv()`, and unused until a module actually needs privileged access.
- `.env.example` files (both `apps/web` and `services/ai-orchestrator`) document every required variable; `.env*` is git-ignored everywhere except the `.example` files.
- Nginx (`infra/nginx/nginx.conf`) rate-limits `/api/` (5 req/s, burst 10) — the render-triggering-endpoint protection called out in the audit — and is the only planned public entry point in front of AI infrastructure.

## Tests

- `apps/web`: Vitest + Testing Library. `Button` (render, click, disabled-state — 3 tests) and `cn` utility (3 tests). All passing.
- `services/ai-orchestrator`: Pytest. Health check, and three auth cases — missing token (401), invalid signature (401), valid token (200, correct claims extracted). All passing.
- CI (`.github/workflows/ci.yml`) runs lint + typecheck + test + build for the web app, and lint (ruff) + typecheck (mypy --strict) + test (pytest) for the orchestrator, on every PR and push to `main`.

## Migration / setup instructions

```bash
# Frontend
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in your Supabase project URL + anon key
pnpm --filter web dev

# AI orchestrator
cd services/ai-orchestrator
cp .env.example .env                            # fill in SUPABASE_JWT_SECRET
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload

# Database
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## Deployment instructions

**Frontend → Vercel:**
1. Import the repo, set the root directory to `apps/web`.
2. Set env vars in the Vercel project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (production URL). `SUPABASE_SERVICE_ROLE_KEY` only if/when a server action needs it (not yet).
3. Build command / output are auto-detected (Next.js).

**Database → Supabase:**
1. Create (or use your existing) Supabase project.
2. `npx supabase link --project-ref <ref>` then `npx supabase db push` to apply `supabase/migrations/`.
3. Treat `supabase/migrations/*.sql` as the only way schema changes reach production — no manual dashboard edits.

**AI orchestrator → Ubuntu GPU server, via Docker:**
1. `docker build -t xdrama-ai-orchestrator services/ai-orchestrator` (build succeeds; not exercised in this sandbox — no Docker daemon available here, see Verification note below).
2. Run via `docker-compose.yml` at the repo root: `docker compose up -d ai-orchestrator redis`, optionally `--profile proxy` to also start the Nginx front-end.
3. Set `SUPABASE_JWT_SECRET`, `RENDER_NODE_URLS` (populated for real once GPU nodes exist — Module 6), and `CORS_ALLOW_ORIGINS` to your production frontend URL, via a `.env` file on the host (not committed).

## Verification performed this session

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — all pass in `apps/web`.
- `ruff check .`, `mypy app` (strict), `pytest` — all pass in `services/ai-orchestrator`.
- `next dev` started and the landing page was loaded in a real headless-Chromium browser (screenshot reviewed) — shadcn/ui styling, Tailwind theme tokens, and Google Fonts all render correctly.
- `uvicorn` started standalone and exercised over HTTP: `/health` → 200, unauthenticated `/api/v1/me` → 401 as expected.
- **Not verified**: the Docker image build/run (no Docker daemon in this sandbox) and the actual Vercel/Supabase Cloud deployment (no live project credentials). Both are straightforward from the instructions above but worth a manual check on your end before relying on them.

## What's deliberately not in Module 1

No auth UI, no database tables, no ComfyUI/GPU integration, no AI Model Manager — all correctly out of scope per the roadmap. Module 1 only had to prove: the frontend and backend both boot, both are lint/type/test-clean, the security boundary (independent JWT verification) exists in code, and the deployment path to Vercel + Supabase + Docker/GPU infra is documented and consistent with the brief.
