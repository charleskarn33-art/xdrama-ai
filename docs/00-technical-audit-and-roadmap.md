# XDrama AI Studio — Technical Audit, Roadmap & Sprint Plan

**Date:** 2026-08-08
**Author:** CTO / Chief AI Architect (Claude)
**Status:** Task 0 deliverable — analysis only, no application code in this round

---

## 0. Finding: This is a greenfield repository

Before auditing, I verified the actual state of `charleskarn33-art/xdrama-ai`:

- Zero branches, zero commits, zero files (`git log`, `git branch -a`, and the GitHub API all confirm the repo has never been pushed to).
- No `package.json`, no `next.config`, no `supabase/` directory, no `docker-compose.yml`, no `vercel.json`, no ComfyUI integration code, no CI config — nothing exists yet.

The brief asks me to audit "the current project" (folder structure, dependencies, Supabase config, auth, DB, UI, components, Docker, Vercel config, ComfyUI integration, AI readiness). There is nothing there to audit. Rather than fabricate findings about code that doesn't exist, this document reframes Task 0 as a **greenfield readiness assessment**: what a production-grade version of each of those areas needs to look like, so the roadmap below is grounded in the real starting point instead of an imaginary one.

**Practical implication for your Development Rules:** "Never rewrite existing working code unless improvements are necessary" doesn't apply yet — everything is new work. "Build one module at a time, wait for approval" absolutely applies, and this document is where that approval gate starts.

---

## 1. Technical Audit

| Area | Status | Notes |
|---|---|---|
| Repository structure | ❌ Missing | No monorepo layout, no app scaffold |
| Frontend (Next.js/React/TS) | ❌ Missing | Not started |
| Backend (Supabase) | ❌ Missing | No project linked, no schema |
| FastAPI AI orchestration service | ❌ Missing | Not started |
| Auth | ❌ Missing | No Supabase Auth config |
| Database schema | ❌ Missing | No migrations |
| UI/component library | ❌ Missing | No shadcn/ui install |
| Docker/Compose | ❌ Missing | No render-node infra |
| Vercel config | ❌ Missing | No deployment target |
| ComfyUI integration | ❌ Missing | No workflow engine |
| CI/CD | ❌ Missing | No GitHub Actions |
| Testing | ❌ Missing | No test runner configured |

**Conclusion:** 100% of the architecture described in your brief needs to be built from scratch. There is no legacy code to preserve or migrate.

---

## 2. Missing Features

Everything in the brief is missing by definition, but for planning purposes the real question is *sequencing*. Grouping the requested modules by dependency order:

**Foundational (nothing else works without these):**
Repo scaffold, monorepo tooling, Next.js app shell, Supabase project + Auth + RLS baseline, CI/CD, environment/secrets management.

**Core data & identity:**
Users, Projects, Story Bible schema (characters/locations/relationships/timeline), Role-Based Access Control.

**Creative pipeline modules:**
Script Studio → Storyboard Studio → Character Studio → Environment Studio → Prop Library → Scene Studio → Timeline Editor → Movie Composer.

**AI infrastructure (the hard, differentiated part):**
AI Model Manager, AI Router, AI Workflow Engine (ComfyUI-backed but never exposed), AI Director, AI Cinematographer, AI Producer.

**Production support:**
Voice Studio, Music Studio, Subtitle Studio, Asset Library, Render Queue, Export Studio, Templates/Workflow Builder.

**Platform operations:**
Admin Dashboard, Notifications, Audit Logs, Billing/entitlements (implied by "commercial SaaS" but not yet specified — flagging as an open question below).

---

## 3. Security Audit

Nothing to audit in code yet, but because security posture is cheapest to set correctly at day one, here's what must be non-negotiable from the first commit:

- **Supabase RLS on by default** on every table, deny-by-default, policies written and tested before any table ships — never bolted on later.
- **JWT verification** on both the Next.js edge/server layer and the FastAPI orchestration service (FastAPI must not trust the frontend; it re-validates Supabase JWTs independently).
- **Service-role keys** never reach the browser or the FastAPI container's public-facing routes — only used in trusted server contexts (Edge Functions, backend jobs).
- **Signed, scoped upload URLs** for Supabase Storage (assets, renders) with content-type/size validation server-side, not just client-side.
- **Rate limiting** at the API gateway/Nginx layer for render-triggering endpoints specifically — GPU render jobs are the most expensive thing a malicious or buggy client could spam.
- **Audit logs** as an append-only table with RLS preventing update/delete, from the first schema migration, not retrofitted.
- **Secrets management**: no API keys (model providers, Trigger.dev, etc.) in client bundles or committed `.env` files; Vercel/Supabase/Docker secrets stores only.
- **ComfyUI isolation**: the render nodes must be on a private network with no public ingress — the FastAPI orchestration layer is the only thing that talks to ComfyUI, enforcing your "never expose ComfyUI directly" requirement at the network layer, not just the application layer.

---

## 4. Performance Audit

Not applicable yet (no code), but the architecture has a few performance-critical decisions to make deliberately rather than by accretion:

- **Render job queue** (Trigger.dev + Redis) must be the only path to GPU workers — no synchronous request ever blocks on a video render.
- **Realtime job status** via Supabase Realtime (job progress, render queue position) instead of polling, to keep the dashboard responsive under load.
- **Asset delivery**: large video/image assets should go through a CDN in front of Supabase Storage (or equivalent), not served directly, once traffic matters.
- **AI Router decisions** should be cheap/fast (small classification step or ruleset) — it must not itself become a latency bottleneck before the actual GPU work starts.

---

## 5. Scalability Recommendations

- **Multi-tenant from day one**: every table keyed by `organization_id`/`user_id` with RLS enforcing isolation, even before multi-org billing exists — retrofitting tenancy later is far more expensive than building it in.
- **Stateless frontend/API layers** (Next.js on Vercel, FastAPI in Docker) so horizontal scaling is just adding replicas; all render state lives in Postgres/Redis, not in-process.
- **GPU worker pool abstraction**: the AI Model Manager and Router should treat GPU nodes as a fungible pool with capability tags (model support, VRAM, health), not hardcoded hostnames — this is what lets you add Ubuntu GPU boxes over time without code changes.
- **Workflow Engine as data, not code**: workflows (templates, user-built graphs) should be stored as versioned JSON/DAG definitions in Postgres, compiled to ComfyUI graphs at render time — this keeps "our own UI, ComfyUI as engine" cleanly separated and makes workflows portable/testable.
- **Idempotent, resumable render jobs**: given GPU jobs are long-running and can fail, the job model needs checkpointing so a failed step doesn't force re-rendering an entire movie.

---

## 6. Prioritized Roadmap

Ordered by hard dependency, not by feature glamour — later modules are genuinely blocked on earlier ones.

1. **Module 1 — Foundation & Repo Scaffold**: monorepo layout, Next.js 16 app, TypeScript strict config, TailwindCSS + shadcn/ui, Supabase project wiring, environment/secrets strategy, CI (lint/type-check/test on PR).
2. **Module 2 — Auth & Multi-Tenant Core Schema**: Supabase Auth, Users/Organizations, RBAC, RLS baseline, audit log table.
3. **Module 3 — Projects & Dashboard Shell**: Projects table + CRUD, Dashboard UI, navigation shell all future studios plug into.
4. **Module 4 — Story Bible**: Characters, Locations, Relationships, Timeline, Universe Memory — the consistency backbone every creative studio depends on.
5. **Module 5 — Script Studio**: script CRUD, script analysis (scene/character/location extraction) — first real AI integration point, feeds everything downstream.
6. **Module 6 — AI Model Manager**: model registry schema, install/enable/disable/health/VRAM tracking, admin UI — required before any model can actually be invoked.
7. **Module 7 — AI Router**: routing rules engine (task → model selection), Advanced Mode override — depends on Model Manager existing first.
8. **Module 8 — AI Workflow Engine**: internal workflow graph format, ComfyUI compiler/executor, Render Queue, job status via Realtime.
9. **Module 9 — Character / Environment / Prop Studios**: reusable asset generation, built on Model Manager + Router + Story Bible.
10. **Module 10 — Storyboard & Scene Studio**: visual scene planning, depends on Script Studio output + Character/Environment studios.
11. **Module 11 — Timeline Editor & Movie Composer**: assembly layer, depends on rendered scene assets existing.
12. **Module 12 — Voice, Music, Subtitle Studios + Lip Sync**: audio pipeline, parallel-buildable once Model Manager/Router exist.
13. **Module 13 — AI Director / Cinematographer / Producer**: higher-level suggestion layers on top of the working pipeline — most valuable once there's a pipeline to advise on.
14. **Module 14 — Export Studio**: multi-format/platform export, depends on Movie Composer output.
15. **Module 15 — Templates & Workflow Builder UI**: user-facing drag-and-drop node editor over the Module 8 engine.
16. **Module 16 — Admin Dashboard & Ops**: cross-cutting visibility into everything built so far.

**Open questions I need answered before/during this roadmap** (flagging rather than guessing):
- Billing/subscription model (Stripe? usage-based GPU-minute billing?) — the brief says "commercial SaaS" but doesn't specify monetization, which affects the Users/Organizations schema in Module 2.
- Target GPU infrastructure availability (do you already have Ubuntu GPU servers provisioned, or does Module 8 need to assume zero infra and mock the render layer initially?).
- Any existing design system/brand assets, or should UI/UX start from a blank shadcn/ui baseline?

---

## 7. Sprint Plan (2-week sprints, one module ≈ one sprint unless noted)

| Sprint | Module | Primary Deliverable |
|---|---|---|
| 1 | Module 1 | Working monorepo, deployed empty Next.js app on Vercel, Supabase project linked, CI green |
| 2 | Module 2 | Auth flow (sign up/in/out), RBAC, RLS policies, audit log |
| 3 | Module 3 | Projects CRUD + Dashboard shell live in production |
| 4 | Module 4 | Story Bible schema + basic CRUD UI |
| 5–6 | Module 5 | Script Studio + first script-analysis AI call (scene/character/location extraction) |
| 7–8 | Module 6 | AI Model Manager (registry, install/health/VRAM UI, admin controls) |
| 9 | Module 7 | AI Router (rule-based initially, Advanced Mode toggle) |
| 10–12 | Module 8 | Workflow Engine + ComfyUI compiler + Render Queue (highest-risk module, most buffer) |
| 13–14 | Module 9 | Character/Environment/Prop Studios |
| 15–16 | Module 10 | Storyboard & Scene Studio |
| 17–18 | Module 11 | Timeline Editor & Movie Composer |
| 19–20 | Module 12 | Voice/Music/Subtitle Studios + Lip Sync |
| 21 | Module 13 | AI Director/Cinematographer/Producer suggestions |
| 22 | Module 14 | Export Studio |
| 23 | Module 15 | Workflow Builder UI |
| 24 | Module 16 | Admin Dashboard |

This is a ~1-year roadmap at sustained single-team velocity; it compresses if you parallelize independent tracks (e.g., audio pipeline alongside video pipeline) once Module 8 is stable.

---

## Next step

Per your Development Rules, I'm stopping here for approval before writing any code. Proposed next action: **Module 1 — Foundation & Repo Scaffold** (monorepo, Next.js 16 + TS + Tailwind + shadcn/ui, Supabase wiring, CI). I'll deliver that module with architecture explanation, SQL (if any), API, UI, docs, tests, migration notes, and deployment instructions, per your format, then stop for approval again before Module 2.
