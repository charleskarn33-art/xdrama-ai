-- Module 9: Character / Environment / Prop Studios.
--
-- "Reusable asset generation, built on Model Manager + Router + Story
-- Bible." Two things ship here:
--
-- 1. `props`, completing the Story Bible's three reusable-entity types
--    (Module 4 already built characters/locations) with the exact same
--    project-scoped, collaborative shape.
--
-- 2. A link from a Story Bible entity to a reference-art generation
--    workflow — deliberately *not* a new parallel generation system.
--    Module 8 already built a complete, tested pipeline (graph ->
--    compiler -> queue -> dispatch) for turning a small graph into a
--    render job; a character's reference image is just another workflow
--    (input -> model_task -> output) run through that same pipeline, so
--    this module only adds a nullable `subject_type`/`subject_id` pair to
--    `workflows` (one workflow per subject, enforced by a partial unique
--    index) rather than inventing a second engine.

-- ============================================================
-- props: parity with characters/locations from Module 4.
-- ============================================================

create table public.props (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  appearance text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index props_project_id_idx on public.props (project_id);

create trigger set_updated_at before update on public.props
  for each row execute function public.set_updated_at();
create trigger audit_props after insert or update or delete on public.props
  for each row execute function public.audit_log_trigger();

alter table public.props enable row level security;

grant select, insert, update, delete on public.props to authenticated;

create policy "props_select" on public.props for select to authenticated
  using (public.is_project_member(project_id));
create policy "props_insert" on public.props for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "props_update" on public.props for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "props_delete" on public.props for delete to authenticated
  using (public.is_project_member(project_id));

-- ============================================================
-- workflows.subject_type/subject_id: which Story Bible entity (if any) a
-- workflow generates reference art for. Null for every ordinary
-- movie/trailer/... workflow from Module 8 — this is additive.
-- ============================================================

create type public.workflow_subject_type as enum ('character', 'location', 'prop');

alter table public.workflows add column subject_type public.workflow_subject_type;
alter table public.workflows add column subject_id uuid;

alter table public.workflows add constraint workflows_subject_pair_check
  check ((subject_type is null) = (subject_id is null));

-- One reference-art workflow per subject: repeated generations reuse it
-- (and its graph is kept in sync with the subject's current text by the
-- application, not by a trigger — see the frontend's generateReferenceArt
-- action), rather than accumulating a new workflow per attempt.
create unique index workflows_subject_unique_idx on public.workflows (subject_type, subject_id)
  where subject_type is not null;

create or replace function public.validate_workflow_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exists boolean;
begin
  if new.subject_type is null then
    return new;
  end if;

  if new.subject_type = 'character' then
    select exists (
      select 1 from public.characters where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  elsif new.subject_type = 'location' then
    select exists (
      select 1 from public.locations where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  else
    select exists (
      select 1 from public.props where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  end if;

  if not v_exists then
    raise exception 'subject_id must reference an existing % in the same project', new.subject_type;
  end if;

  return new;
end;
$$;

create trigger validate_workflow_subject
  before insert or update of subject_type, subject_id, project_id on public.workflows
  for each row execute function public.validate_workflow_subject();

-- ============================================================
-- Three new image-category routing_rules task types, the router inputs
-- the reference-art workflows' model_task nodes use. Seeded against the
-- image-category models Module 6 already registered (flux, sdxl).
-- ============================================================

insert into public.routing_rules (task_type, category, description, preferred_model_slugs) values
  ('character_reference_image', 'image', 'Reference/concept art for a character''s appearance.', array['flux', 'sdxl']),
  ('environment_concept_art', 'image', 'Concept art for a location/environment.', array['flux', 'sdxl']),
  ('prop_render', 'image', 'Reference render for a prop/object.', array['flux', 'sdxl']);
