# Module 15 — Templates & Workflow Builder UI

**Status:** Complete, pending your approval to move to Module 16.

## Architecture

Module 8 built `workflow_templates` (the platform-wide catalog projects clone from) and a full node-based Workflow Builder (React Flow) — but the builder only ever lived inside a project's workflow detail page, and the template catalog itself had no admin UI at all; the only rows in `workflow_templates` were the ones the seed migration inserted with a superuser connection that bypasses RLS entirely. This module closes both gaps without inventing new infrastructure:

- **A platform-admin Workflow Templates section** (`/admin/templates`), mirroring the existing `/admin/models` and `/admin/routing` admin pages: list templates grouped by category, create one, edit its name/description/category, and edit its node graph.
- **The Workflow Builder canvas itself generalized for reuse.** It was tightly coupled to one call site — hardcoded `orgSlug`/`projectId`/`workflowId` props and a hardcoded `updateWorkflow` server action call inside the component. Rather than fork a second copy of ~200 lines of React Flow wiring for the admin template editor, the component moved to a shared location (`src/components/workflow-editor/`) and its save behavior became an injected `onSave: (graph) => Promise<{error}>` prop. Each caller — the project workflow page and the new admin template page — supplies its own server action pre-bound with its own IDs via the documented Next.js `.bind(null, ...args)` pattern, keeping the canvas itself ignorant of which table it's saving into.
- **True drag-and-drop node creation**, replacing "click a button, node appears at an offset position." A new `NodePalette` sidebar lists the three node types as draggable chips; dropping one onto the canvas uses React Flow v12's `useReactFlow().screenToFlowPosition()` (verified against the installed package's actual `.d.ts` before use, not assumed from memory) to place the new node exactly under the cursor, in flow coordinates rather than screen coordinates.
- **Workflow rename**, the one item Module 8 explicitly deferred for project workflows: an inline click-to-edit control next to the workflow title on `/dashboard/.../workflows/[workflowId]`, reusing the existing `updateWorkflow` action's optional `name` field — no new backend needed.

No new database tables. `workflow_templates` was fully built in Module 8; this module is the UI and test-coverage layer on top of it.

## Database changes

No migration. One test-only change: `supabase/tests/ai_workflow_engine.test.sql` (Module 8's original test file) gained 3 assertions closing a real coverage gap — a platform admin actually exercising `workflow_templates`' insert/update/delete RLS policies (previously only the seed migration's superuser insert, which bypasses RLS, had ever gone through those paths). A scratch `admin-test-template` row is inserted, asserted visible, renamed, asserted renamed, deleted, and asserted gone, as the platform-admin actor (`noah`), bracketed by `set_local_actor`/`clear_local_actor` calls consistent with every other actor-switch in the file.

### Tested — 3 new assertions (180 total)

"a platform admin can insert / update / delete a workflow template" — all in `ai_workflow_engine.test.sql`.

## Frontend

- **`src/lib/validations/workflow-templates.ts`** (new): `createWorkflowTemplateSchema` (slug/name/description/category), `updateWorkflowTemplateSchema` (name/description/category — no slug, matching the "slugs don't change after creation" convention already used for org slugs), `updateWorkflowTemplateGraphSchema` (templateId + `workflowGraphSchema` reused from Module 8), `deleteWorkflowTemplateSchema`. `TEMPLATE_CATEGORIES` matches the `workflow_templates.category` check constraint exactly.
- **`src/app/admin/templates/actions.ts`** (new): `createWorkflowTemplate` (inserts with a minimal valid starter graph — one input node — so a new template is immediately openable in the builder without a placeholder that would fail `validate_workflow_graph()`), `updateWorkflowTemplate` (details only), `updateWorkflowTemplateGraph` (graph only — the shape the shared builder's `onSave` expects), `deleteWorkflowTemplate`. All gated by `requirePlatformAdmin()`, the same helper every other admin action in this app uses.
- **`src/app/admin/templates/page.tsx`**: templates grouped by category, same visual shape as `/admin/models`.
- **`src/app/admin/templates/new/`**: `new-template-form.tsx` (react-hook-form + zod, matching every other "new X" form in the app) → redirects to the new template's detail page on success.
- **`src/app/admin/templates/[templateId]/`**: `edit-template-form.tsx` (details + delete, matching the shape of `edit-voice-line-form.tsx`) and `page.tsx`, which also renders the shared `WorkflowEditor` bound to `updateWorkflowTemplateGraph`.
- **`src/components/workflow-editor/`** (new shared directory, moved from the project-workflow route): `xdrama-node.tsx`, `node-inspector.tsx` (both moved verbatim), `node-palette.tsx` (new — the draggable chip list), `workflow-editor.tsx` (generalized: `onSave` prop instead of a hardcoded action, `NodePalette` + `onDrop`/`onDragOver` handlers added to the canvas).
- **`src/app/dashboard/.../workflows/[workflowId]/`**: `rename-workflow-form.tsx` (new — inline click-to-edit); `page.tsx` updated to import `WorkflowEditor` from the new shared location and pass `onSave={updateWorkflowGraph.bind(null, orgSlug, projectId, workflowId)}` instead of the old ID props; the old route-local `workflow-editor.tsx`/`xdrama-node.tsx`/`node-inspector.tsx` deleted.
- **`src/app/dashboard/.../workflows/actions.ts`**: gained `updateWorkflowGraph`, a thin `(orgSlug, projectId, workflowId, graph) => updateWorkflow(...)` wrapper matching the new `onSave` shape, meant to be called via `.bind()`.
- **`AdminNav`**: gained a "Templates" tab alongside "Models" and "Router".

## Backend (AI orchestrator)

No changes. This module is pure frontend/admin-UI on top of the schema and dispatch infrastructure Modules 6–14 already built; confirmed via `git status` that `services/ai-orchestrator/` and `supabase/migrations/` have no changes in this module's diff.

## Security

Same layered RBAC as every module: `workflow_templates` writes require `is_platform_admin()` (unchanged policy from Module 8 — this module is the first thing to actually exercise it via real user flows and the first to positively test it). Project workflow rename goes through the existing `updateWorkflow` action and its `is_project_member()`-gated RLS policy — no new privilege boundary. `requirePlatformAdmin()` gates every action in `admin/templates/actions.ts`, matching `admin/models`.

## Tests

- `supabase/tests`: **180 SQL assertions** (was 177) — 3 new in `ai_workflow_engine.test.sql`.
- `apps/web`: **103 Vitest tests** (was 97) — 6 new in `workflow-templates.test.ts` (valid/invalid slug, valid/invalid category, valid graph, empty-node-list rejection).
- `services/ai-orchestrator`: unchanged — 38 passed, 4 skipped (pre-existing skips, unrelated to this module), `ruff check` and `mypy app` both clean.

## Migration / setup instructions

No migration to push — no schema changes. `pnpm build` picks up the new/moved routes and components automatically; nothing else to configure.

## Verification performed this session

- `pnpm lint` / `pnpm typecheck` / `pnpm test` (103 tests) / `pnpm build` in `apps/web` — all pass; build output confirms the new `/admin/templates`, `/admin/templates/new`, `/admin/templates/[templateId]` routes and the modified `/dashboard/.../workflows/[workflowId]` route all compile.
- `supabase/tests/run_tests.sh` against a local Postgres — **180 / 180 assertions passed**, including the 3 new platform-admin `workflow_templates` write assertions.
- `ruff check` / `mypy app` / `pytest -q` in the orchestrator (via its `.venv`) — all pass, confirming this module genuinely made no backend changes.
- Live dev server with placeholder Supabase credentials: unauthenticated requests to `/admin/templates`, `/admin/templates/new`, and `/dashboard/acme/projects/.../workflows/...` all correctly 307 to `/login?next=...`.
- `git status --porcelain -- services/ai-orchestrator supabase/migrations` — empty, confirming the "pure frontend module" scope held.

## What's deliberately not in Module 15

Template deletion protection when project workflows were cloned from it (`workflows.source_template_id` is a nullable FK with no `on delete restrict`; deleting a template does not affect workflows already cloned from it, and the delete confirmation copy says so — building referential-integrity UI around a rarely-exercised admin action wasn't warranted here); template versioning/history (`workflow_templates` has no version column — out of scope, matching the "no history tables beyond what's already append-only" posture from Modules 8–14); a template preview/thumbnail image (no image-generation dispatch wired to templates — would require inventing a new subject type in `workflow_subject_type` for a cosmetic feature); and, as with the rest of this app, real dispatch behavior for `model_task` nodes still depends entirely on the AI Model Manager/Router having installed models, which it does not in this deployment.
