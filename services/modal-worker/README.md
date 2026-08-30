# xdrama-comfyui-worker (Modal)

The GPU compute backend for XDrama AI Studio's render pipeline — see
[`docs/17-module-17-modal-gpu-compute-provider.md`](../../docs/17-module-17-modal-gpu-compute-provider.md)
for the full architecture. This app is the only thing that ever talks to
ComfyUI; it is never exposed to end users. The AI orchestrator
(`services/ai-orchestrator`) is the only caller, via
`app.core.compute.modal_provider.ModalComputeProvider`.

## Deploy

```bash
pip install modal
modal setup   # or set MODAL_TOKEN_ID / MODAL_TOKEN_SECRET directly

modal secret create xdrama-supabase \
  SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

modal deploy comfyui_app.py
```

Then set `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` on the AI orchestrator
(see `services/ai-orchestrator/.env.example`) so it can reach this app.

## What actually works today

The App, its persistent `xdrama-model-weights` Volume, the GPU-attached
`generate` function's signature/Secret/timeout wiring, and the
stage-reporting control flow (`render_jobs.stage` transitions through
`starting → downloading_models → generating → post_processing →
uploading → completed/failed`, written directly to Supabase with the
service-role key).

## What's deliberately not implemented

`_ensure_models_present`, `_run_comfyui`, `_post_process`, and
`_upload_to_supabase_storage` all raise `NotImplementedError`. None of
the 8 models this project tracks (Wan 2.2, HunyuanVideo, SkyReels V2,
CogVideoX, Open-Sora, LTX Video, FLUX, SDXL) has a real installed ComfyUI
custom-node package behind it yet, so there is no real `class_type` name,
model-weights download URL, or HF repo id to wire up — installing and
introspecting one of those packages is real infrastructure work that
needs an actual GPU environment to do honestly, not something to guess
at from this repo. This file has never been deployed to a real Modal
account or run against a real GPU.
