-- Module 16: Admin Dashboard & Ops.
--
-- "Cross-cutting visibility into everything built so far" is genuinely
-- blocked today: a platform admin's Supabase session is subject to the
-- exact same RLS as every other authenticated user, and every tenant
-- table so far (organizations, projects, render_jobs, export_jobs,
-- ai_suggestions, ...) scopes SELECT to org/project membership. Module 6
-- already established the pattern this migration extends — an
-- additional, purely additive `is_platform_admin()` SELECT policy per
-- table (RLS ORs permissive policies together, so every existing
-- org/project-scoped policy is completely unaffected; this only ever
-- widens what a platform admin specifically can read, never anyone
-- else, and never write access).
--
-- Scoped deliberately to what platform *operations* visibility actually
-- needs — tenant/user/job-queue metadata — not full org content. This
-- does NOT grant platform admins read access to scripts, characters,
-- timelines, voice lines, or any other creative content table; that
-- boundary is intentional (see docs/16-module-16-admin-dashboard-ops.md).

create policy "organizations_select_platform_admin"
  on public.organizations for select
  to authenticated
  using (public.is_platform_admin());

create policy "org_members_select_platform_admin"
  on public.organization_members for select
  to authenticated
  using (public.is_platform_admin());

create policy "profiles_select_platform_admin"
  on public.profiles for select
  to authenticated
  using (public.is_platform_admin());

create policy "projects_select_platform_admin"
  on public.projects for select
  to authenticated
  using (public.is_platform_admin());

create policy "render_jobs_select_platform_admin"
  on public.render_jobs for select
  to authenticated
  using (public.is_platform_admin());

create policy "export_jobs_select_platform_admin"
  on public.export_jobs for select
  to authenticated
  using (public.is_platform_admin());

create policy "ai_suggestions_select_platform_admin"
  on public.ai_suggestions for select
  to authenticated
  using (public.is_platform_admin());
