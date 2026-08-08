-- Module 6: AI Model Manager.
--
-- The model registry is platform-level, not org-scoped — unlike every
-- table so far. Models live on GPU infrastructure the platform operator
-- controls, not something individual organizations manage, and the
-- (future) AI Router needs to see the same catalog regardless of which
-- org is making a request. This introduces the first new RBAC concept
-- since Module 2: a platform admin flag, distinct from org roles.

alter table public.profiles add column is_platform_admin boolean not null default false;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke execute on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Platform admins can read every audit log, not just their own orgs' —
-- this is additive: RLS ORs multiple permissive policies together, so
-- the existing org owner/admin policy from Module 2 is unaffected.
create policy "audit_logs_select_platform_admin"
  on public.audit_logs for select
  to authenticated
  using (public.is_platform_admin());

-- ============================================================
-- Registry
-- ============================================================

create type public.ai_model_category as enum ('video', 'image', 'audio', 'voice', 'lip_sync', 'llm');
create type public.ai_model_install_status as enum ('not_installed', 'downloading', 'installed', 'failed');
create type public.ai_model_health_status as enum ('unknown', 'healthy', 'unhealthy');

create table public.ai_models (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 200),
  category public.ai_model_category not null,
  description text,
  version text not null default 'latest',
  source_url text,
  supported_features text[] not null default '{}',
  vram_gb numeric(5, 1),
  disk_gb numeric(6, 1),
  install_status public.ai_model_install_status not null default 'not_installed',
  is_enabled boolean not null default false,
  health_status public.ai_model_health_status not null default 'unknown',
  last_health_check_at timestamptz,
  gpu_assignment text,
  benchmark_results jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_models is 'Platform-wide model registry. Not org-scoped — see migration header. Install/uninstall/health-check are executed by the AI orchestrator service against real GPU nodes; this table is the source of truth those actions read from and write to.';

create index ai_models_category_idx on public.ai_models (category);
create index ai_models_install_status_idx on public.ai_models (install_status);

create trigger set_updated_at
  before update on public.ai_models
  for each row execute function public.set_updated_at();

-- ============================================================
-- audit_log_trigger gains a platform-level branch: ai_models has neither
-- org_id nor project_id, so its events are logged with org_id = null
-- (audit_logs.org_id is nullable for exactly this case) and are visible
-- only via the platform-admin policy just added above.
-- ============================================================

create or replace function public.audit_log_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_target_id text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_table_name = 'organizations' then
    v_org_id := coalesce(new.id, old.id);
    v_target_id := coalesce(new.id, old.id)::text;
  elsif tg_table_name = 'organization_members' then
    v_org_id := coalesce(new.org_id, old.org_id);
    v_target_id := coalesce(new.user_id, old.user_id)::text;
  elsif tg_table_name = 'projects' then
    v_org_id := coalesce(new.org_id, old.org_id);
    v_target_id := coalesce(new.id, old.id)::text;
  elsif tg_table_name = 'ai_models' then
    v_org_id := null;
    v_target_id := coalesce(new.id, old.id)::text;
  else
    -- project-scoped tables (characters, locations, character_relationships,
    -- timeline_events, story_bible_notes, scripts, and any future one with a
    -- plain project_id column): resolve org_id via the parent project.
    select p.org_id into v_org_id
    from public.projects p
    where p.id = coalesce(new.project_id, old.project_id);
    v_target_id := coalesce(new.id, old.id)::text;
  end if;

  if tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;

  insert into public.audit_logs (org_id, actor_id, action, target_type, target_id, metadata)
  values (
    v_org_id,
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_target_id,
    jsonb_build_object('old', v_old, 'new', v_new)
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_ai_models
  after insert or update or delete on public.ai_models
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RLS: every authenticated user can see the catalog (the future AI
-- Router and any "Advanced Mode" model picker need read access
-- regardless of org); only platform admins can change it.
-- ============================================================

alter table public.ai_models enable row level security;

grant select on public.ai_models to authenticated;
grant insert, update, delete on public.ai_models to authenticated;

create policy "ai_models_select_all" on public.ai_models for select
  to authenticated
  using (true);

create policy "ai_models_insert_platform_admin" on public.ai_models for insert
  to authenticated
  with check (public.is_platform_admin());

create policy "ai_models_update_platform_admin" on public.ai_models for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "ai_models_delete_platform_admin" on public.ai_models for delete
  to authenticated
  using (public.is_platform_admin());

-- ============================================================
-- Seed the catalog with the models named in the product brief. All start
-- not_installed/disabled/unknown — nothing is actually deployed anywhere;
-- see docs/06-module-6-ai-model-manager.md for what "install" does today
-- without real GPU infrastructure attached.
-- ============================================================

insert into public.ai_models (slug, name, category, description, supported_features, vram_gb) values
  ('wan-2-2', 'Wan 2.2', 'video', 'General-purpose text/image-to-video generation.', array['text-to-video', 'image-to-video'], 24),
  ('hunyuan-video', 'HunyuanVideo', 'video', 'High-fidelity video generation, strong on human motion.', array['text-to-video', 'image-to-video'], 45),
  ('skyreels-v2', 'SkyReels V2', 'video', 'Character-consistency-focused video generation.', array['text-to-video', 'character-consistency'], 24),
  ('cogvideox', 'CogVideoX', 'video', 'Image-to-video generation.', array['image-to-video'], 18),
  ('open-sora', 'Open-Sora', 'video', 'Long-form narrative video generation.', array['text-to-video', 'long-form'], 40),
  ('ltx-video', 'LTX Video', 'video', 'Fast draft-quality video generation.', array['text-to-video', 'fast-draft'], 12),
  ('stable-video-diffusion', 'Stable Video Diffusion', 'video', 'Image-to-video generation.', array['image-to-video'], 16),
  ('flux', 'FLUX', 'image', 'High-quality text-to-image generation.', array['text-to-image'], 16),
  ('sdxl', 'Stable Diffusion XL', 'image', 'Text-to-image generation.', array['text-to-image'], 8),
  ('controlnet', 'ControlNet', 'image', 'Conditioned image generation (pose, depth, edges).', array['image-conditioning'], 6),
  ('musicgen', 'MusicGen', 'audio', 'Text-to-music generation.', array['text-to-music'], 8),
  ('audiocraft', 'AudioCraft', 'audio', 'Text-to-audio and sound-effect generation.', array['text-to-audio'], 8),
  ('stable-audio-open', 'Stable Audio Open', 'audio', 'Text-to-audio generation.', array['text-to-audio'], 8),
  ('kokoro', 'Kokoro', 'voice', 'Lightweight text-to-speech.', array['text-to-speech'], 2),
  ('piper', 'Piper', 'voice', 'Fast, local text-to-speech.', array['text-to-speech'], 1),
  ('coqui-tts', 'Coqui TTS', 'voice', 'Multi-speaker text-to-speech with voice cloning.', array['text-to-speech', 'voice-cloning'], 4),
  ('musetalk', 'MuseTalk', 'lip_sync', 'Real-time lip-sync for talking-head video.', array['lip-sync'], 8),
  ('latentsync', 'LatentSync', 'lip_sync', 'High-fidelity lip-sync generation.', array['lip-sync'], 12),
  ('qwen', 'Qwen', 'llm', 'General-purpose LLM for script/prompt reasoning.', array['text-generation', 'reasoning'], 16),
  ('llama', 'Llama', 'llm', 'General-purpose LLM for script/prompt reasoning.', array['text-generation', 'reasoning'], 16),
  ('deepseek', 'DeepSeek', 'llm', 'General-purpose LLM for script/prompt reasoning.', array['text-generation', 'reasoning'], 16);
