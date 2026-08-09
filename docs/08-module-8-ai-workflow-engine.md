# Module 8 — AI Workflow Engine

**Status:** Complete, pending your approval to move to Module 9.

## Architecture

The brief asks for "an AI Workflow Engine similar to ComfyUI but with a custom UI" — drag-and-drop nodes, saved workflows, and named templates (Movie/Trailer/Commercial/Music Video/Animation). This module builds the full pipeline for that: a graph data model validated in Postgres, a React Flow-based visual editor, a Python compiler that turns a graph into ComfyUI's real prompt-API JSON shape, a Redis-backed render queue, and a dispatch endpoint — wired end to end, but honest about the one real gap: there are no GPU render nodes or a ComfyUI instance in this deployment yet, so dispatch validates and queues for real and then reports that gap rather than fabricating a render.

**Graph validity lives in Postgres, not the client.** A `workflow_templates`/`workflows` row's `graph` column is a `jsonb` blob (`{ nodes: [...], edges: [...] }`), and a `BEFORE INSERT/UPDATE` trigger (`validate_workflow_graph()`) is the single source of truth for whether it's well-formed: known node types, unique ids, edges that reference real nodes, and — the interesting part — **no cycles**, checked with a recursive-CTE all-pairs reachability query. The frontend's Zod schema validates shape (so the UI can show inline errors for obviously-broken input) but explicitly does not re-implement cycle detection; a save that violates the trigger surfaces the database's rejection rather than silently disagreeing with it. Same reasoning as every prior module's complex invariants (RBAC, relationship project-scoping, slug validation): one implementation, tested once, trusted everywhere.

**The compiler is honest about what's real.** ComfyUI's prompt-API JSON format (`{node_id: {class_type, inputs}}`, with `[node_id, output_index]` link tuples) is genuine, documented, and stable — `compile_to_comfyui()` produces exactly that shape. What it does *not* do is invent `class_type` names for third-party custom nodes it has no way to verify (e.g., "which ComfyUI node actually wraps WAN 2.2"); `model_task` nodes compile to an explicit placeholder (`XDrama.ModelTask.<task_type>`) with a docstring explaining why, so the gap is visible in the code rather than papered over with a plausible-looking guess.

**Dispatch follows the Module 6/7 honest-failure pattern**: `POST /v1/render-jobs/{id}/dispatch` validates the job and workflow (via the caller's own RLS grants — this is the first orchestrator endpoint to use a user-scoped Supabase client instead of the service-role one, since "can this user touch this render job" is exactly what `render_jobs`' existing RLS policy already answers), compiles the graph, and enqueues to Redis for real — proving the queue round-trip actually works — but then checks whether any GPU render nodes are configured (`RENDER_NODE_URLS`). With none configured (this deployment's actual current state), it returns `200 {ok: false, message: "..."}`, not a 500: no render nodes is an expected, legitimate state, not a server error.

## Database changes

New migration: `supabase/migrations/20260809091255_ai_workflow_engine.sql`.

- **`render_job_status` enum**: `queued | running | completed | failed | cancelled`.
- **`validate_workflow_graph()`** (trigger function): `graph` must have `nodes`/`edges` arrays, at least one node, every node a valid `id`/`type` (`input`/`model_task`/`output`) with unique ids, every edge's `source`/`target` referencing an existing node id, and — via `WITH RECURSIVE edges AS (...), reachable AS (... UNION ...)` (not `UNION ALL`, which is what actually guarantees termination on cyclic input) — no cycles. Prototyped and hand-verified directly in `psql` against five cases (linear acyclic, a 3-node cycle, a self-loop, a diamond, empty edges) before being committed to the migration.
- **`workflow_templates`**: platform-level (`slug`, `name`, `description`, `category` check-constrained to the brief's five template categories, `graph`), RLS shaped exactly like `ai_models`/`routing_rules` — every authenticated user reads, only platform admins write. Seeded with five real, trigger-valid 3-node graphs (`movie-starter`, `trailer-starter`, `commercial-starter`, `music-video-starter`, `animation-starter`), each `input → model_task → output` with a `taskType` matching one of Module 7's seeded `routing_rules.task_type`s.
- **`workflows`**: project-scoped (`project_id`, `name`, `graph`, `source_template_id` FK, `created_by` defaulting to `auth.uid()`), RLS collaborative like `scripts` — any project member can read/write/delete.
- **`render_jobs`**: project-scoped (`project_id`, `workflow_id` FK, `status`, `input_params jsonb`, `output_asset_url`, `error_message`, `progress numeric(5,2)`, `created_by`, `started_at`/`completed_at`). RLS grants select/insert/update only — **no delete policy at all**, so render history can't be erased by any role, the same durability choice already made for `audit_logs`.
- **`audit_log_trigger()` extended again**: `workflow_templates` joins the platform-level branch (alongside `ai_models`, `routing_rules`); `workflows` and `render_jobs` fit the existing generic `project_id`-bearing branch unchanged.
- **`alter publication supabase_realtime add table public.render_jobs;`** — render job status updates stream to the frontend without polling.

### Tested — 14 new assertions (89 total)

`supabase/tests/ai_workflow_engine.test.sql`: template seeding and read access, write blocked for non-admins, cloning a template into a project workflow (with its audit-log entry via the project_id branch), a cyclic graph rejected, a dangling edge rejected, a render job defaulting to `queued`, collaborative rename/cancel by a non-creator project member, `render_jobs` delete blocked entirely (`insufficient_privilege`, not just an RLS no-op), cross-org isolation for both new tables, and `anon` having zero access. `supabase/tests/local_auth_stub.sql` gained an idempotent `create publication supabase_realtime` stub, since the harness's plain local Postgres doesn't have Supabase's pre-provisioned publication that the migration's `ALTER PUBLICATION` needs to already exist.

## Backend (AI orchestrator)

- **`app/workflows/graph.py`**: Pydantic `WorkflowNode`/`WorkflowEdge`/`WorkflowGraph`, and `topological_order()` — Kahn's algorithm, deterministic via sorted-queue processing, raising `GraphCycleError` on a cycle (belt-and-suspenders alongside the Postgres check, since the orchestrator receives graphs independently of any insert/update path).
- **`app/workflows/comfyui_compiler.py`**: `compile_to_comfyui(graph) -> dict`, producing ComfyUI's real prompt-API shape as described above.
- **`app/core/queue.py`**: a Redis FIFO queue (`redis.asyncio`, `LPUSH`/`BRPOP`) for render jobs — `enqueue_render_job`/`dequeue_render_job`, tested against a real local `redis-server`, not mocked.
- **`app/core/supabase.py`**: new `get_user_scoped_client` dependency — built fresh per request (never cached or shared, since mutating a shared client's auth header per-request would race under concurrent requests), authenticated with the caller's own bearer token via `client.postgrest.auth(token)`. This is the first orchestrator endpoint where "is this request authorized" *is* the existing RLS policy, rather than a separate authorization check followed by a service-role write.
- **`app/api/render_jobs.py`**: `POST /v1/render-jobs/{job_id}/dispatch` — fetch job + workflow via the user-scoped client (unknown/not-yours jobs 404 naturally through RLS, no separate ownership check needed), reject if status isn't `queued` (409), compile the graph (validation failure fails honestly), check `RENDER_NODE_URLS` is configured (empty → honest `200 {ok:false}`), enqueue+dequeue for real to prove the round trip, then attempt `_dispatch_compiled_workflow()` — which raises `NotImplementedError` today (no real render node to hand the compiled workflow to), caught and reported the same honest way Module 6's model install/health-check endpoints report missing infrastructure.

## Frontend

- **`/dashboard/[orgSlug]/projects/[projectId]/workflows`**: lists the project's workflows, plus a gallery of the five platform templates, each with an inline "use this template" form that clones the template's graph into a new project-scoped workflow.
- **`/dashboard/[orgSlug]/projects/[projectId]/workflows/[workflowId]`**: the workflow detail page — fetches the workflow (404 via `notFound()` if it doesn't belong to this project, matching every other module's detail-page pattern) and its render job history, and renders the editor, the render panel, and a delete button.
  - **`workflow-editor.tsx`**: the React Flow canvas (`@xyflow/react`) — a custom `XDramaNode` component color-coded by type (input/model_task/output) with conditional handles, toolbar buttons to add each node type, drag-to-connect via `onConnect`/`addEdge`, a `NodeInspector` side panel for editing the selected node's label/key/task-type/JSON params (with parse-error handling), and a Save button that round-trips the flow state to a `WorkflowGraph` and calls the `updateWorkflow` server action.
  - **`render-panel.tsx`**: subscribes to Supabase Realtime `postgres_changes` on `render_jobs` filtered by `workflow_id`, so job status updates appear live without polling; a Render button calls `createAndDispatchRenderJob`, which inserts the `render_jobs` row and then calls the orchestrator's dispatch endpoint; failed jobs show their `error_message` inline.
- **`src/lib/validations/workflows.ts`**: Zod schemas shared by the editor's inline params validation and the server actions — explicitly documented as *not* re-implementing cycle detection, deferring to the Postgres trigger.
- **Project tabs** gained a "Workflows" entry.

## Security

Same layered RBAC as every prior module (`is_project_member()` for `workflows`/`render_jobs`, `is_platform_admin()` for `workflow_templates`), full audit trail (`audit_log_trigger()` now spans seven tables), and — new this module — `render_jobs` has no delete grant at all, so render history is append/update-only by design, not just by convention. The dispatch endpoint's use of a user-scoped Supabase client means its authorization *is* the tested RLS policy, rather than a second, potentially-divergent check reimplemented in Python.

## Tests

- `supabase/tests`: **89 SQL assertions** (was 75) — 14 new in `ai_workflow_engine.test.sql`.
- `services/ai-orchestrator`: **29 pytest tests** (was 14) — `test_graph.py` (4), `test_comfyui_compiler.py` (5), `test_queue.py` (3, against real local Redis), `test_render_jobs.py` (7, via the existing `FakeSupabaseClient` fixture pattern, including one exercising a real Redis enqueue/dequeue round trip before hitting the honest `NotImplementedError`). `ruff check` and `mypy --strict` both clean across 19 source files.
- `apps/web`: **63 Vitest tests** (was 53) — 9 new in `workflows.test.ts` covering the Zod schemas.

## Migration / setup instructions

`npx supabase db push` picks up the new migration. The orchestrator needs `SUPABASE_ANON_KEY` set (added to `.env.example`) to build user-scoped clients, and `REDIS_URL` (already required since the queue is real, not new to this module) pointing at a reachable Redis instance.

## Deployment instructions

- CI's `ai-orchestrator` job now runs a `redis:7-alpine` service container so `test_queue.py`/`test_render_jobs.py`'s real-Redis tests run in CI, not just locally.
- No change to the Vercel/Supabase/Ubuntu-GPU-server deployment shape described in the technical audit — `RENDER_NODE_URLS` is the env var that will eventually point the orchestrator at real GPU render nodes; until that infrastructure exists, dispatch will keep honestly reporting the gap.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` in `apps/web` — all pass (63 tests, 28 routes including the two new workflow routes).
- `ruff check` / `mypy --strict` / `pytest -q` in `services/ai-orchestrator` — all pass (29 tests), plus a live smoke test: `uvicorn app.main:app`, `GET /health` → 200, unauthenticated `POST /api/v1/render-jobs/foo/dispatch` → 401.
- `supabase/tests/run_tests.sh` — 89/89 assertions pass.
- Live dev server with dummy Supabase credentials: `/dashboard/acme/projects/.../workflows` and `/dashboard/acme/projects/.../workflows/...` both correctly 307 an unauthenticated request to `/login?next=...`.
- **Not verified**: an actual render completing against real GPU infrastructure, real ComfyUI custom-node class names, or a real render-node agent API — none of that infrastructure exists yet in this deployment, and this module's job was to build the complete, honest pipeline up to that boundary, not to fabricate what's on the other side of it.

## What's deliberately not in Module 8

A polished node-palette drag source (nodes are added via toolbar buttons, not dragged from a sidebar — functionally equivalent, less UI work for a first pass), workflow versioning/history (the `workflows` table holds one current `graph`, no snapshotting), a workflow-rename UI (the `updateWorkflow` action and schema support it — `name` is optional and independent of `graph` — but no input is wired up yet, matching Module 7's deferred rule-editing UI), progress-bar rendering from `render_jobs.progress` (the column exists and is tracked, but nothing populates it yet since no real render node reports back), and, as with every module since Module 6, any of this actually running against real GPU/ComfyUI infrastructure.
