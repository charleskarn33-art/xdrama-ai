-- Module 17: Modal GPU Compute Provider.
--
-- Replaces the previously-assumed dedicated GPU server with Modal.com
-- serverless GPU compute as the AI orchestrator's dispatch target (see
-- services/ai-orchestrator/app/core/compute/ and
-- services/modal-worker/comfyui_app.py). This migration adds the columns
-- real dispatch needs — which provider handled a job, the provider's own
-- job handle for tracking/cancellation — and a granular in-flight stage
-- so the job queue can report real GPU-pipeline progress, not just
-- "queued vs running vs done".
--
-- The coarse `render_job_status` enum from Module 8 is left untouched —
-- no reason to churn every dispatch-honesty test that already asserts
-- against it. `stage` is a new, separate, nullable column that is only
-- meaningful while status = 'running', written by whichever compute
-- provider is actually executing the job (Modal today), not by the
-- dispatching client.

create type public.render_job_stage as enum (
  'starting',
  'downloading_models',
  'generating',
  'post_processing',
  'uploading'
);

alter table public.render_jobs
  add column stage public.render_job_stage,
  add column compute_provider text not null default 'modal',
  add column provider_job_id text;

comment on column public.render_jobs.stage is
  'Fine-grained GPU-pipeline progress while status = ''running''. Null in every other status. Written by the compute provider (see compute_provider), not the dispatching client.';
comment on column public.render_jobs.compute_provider is
  'Which AIComputeProvider implementation is executing this job. ''modal'' today; the column exists so a future provider (RunPod, AWS, a dedicated GPU server, ...) never requires a schema change, only a new value here.';
comment on column public.render_jobs.provider_job_id is
  'The compute provider''s own handle for this job (e.g. a Modal FunctionCall id) — used to poll status or request cancellation. Null until dispatch actually reaches the provider.';

-- Which Modal Function implements each model. Null until an operator has
-- actually deployed services/modal-worker/comfyui_app.py and wired a
-- model to it — the AI Model Manager already tracks install/health
-- status per model (Module 6); this is the added piece of metadata a
-- compute-provider dispatch needs in order to know *where* to send a job
-- for a given model, once compute happens somewhere real.
alter table public.ai_models
  add column compute_function_name text;

comment on column public.ai_models.compute_function_name is
  'The Modal Function name (within the xdrama-comfyui-worker app) that serves this model. Null means no Modal deployment has been wired up for it yet.';
