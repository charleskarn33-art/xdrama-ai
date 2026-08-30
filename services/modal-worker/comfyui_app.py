"""Modal app: the GPU worker for XDrama AI Studio's render pipeline.

Deploy with:
    modal deploy services/modal-worker/comfyui_app.py

This is the "internal AI workflow engine" ComfyUI has always been
documented to run as (see docs/00-technical-audit-and-roadmap.md,
Section 3: "never expose ComfyUI directly"). The AI orchestrator
(services/ai-orchestrator) is the only caller, via
app.core.compute.modal_provider.ModalComputeProvider, which invokes the
`generate` function below by name (xdrama-comfyui-worker/generate) and
never talks to Modal (or ComfyUI) any other way.

What this file provides today, and is real: the Modal App, a persistent
Volume for model weights, a GPU-attached function definition, its Secret
wiring, and the control flow that writes real progress
(render_jobs.stage) to Supabase as a job moves through the pipeline —
using a service-role client, the same "trusted server-side write, RLS
bypassed deliberately" pattern the orchestrator itself uses for
platform-admin actions (see services/ai-orchestrator/app/core/config.py's
supabase_service_role_key docstring).

What this file does NOT do: actually run ComfyUI against a real,
installed custom-node package for any of the 8 models this project
tracks (Wan 2.2, HunyuanVideo, SkyReels V2, CogVideoX, Open-Sora, LTX
Video, FLUX, SDXL). The compiled workflow's node `class_type` strings are
placeholders (see the orchestrator's app/workflows/comfyui_compiler.py
docstring) — nobody has installed and introspected real ComfyUI
custom-node packages for these models in this project, so there is no
real class_type name or model-weights download URL to wire up yet. The
four `_ensure_models_present`/`_run_comfyui`/`_post_process`/
`_upload_to_supabase_storage` functions below raise NotImplementedError
for exactly this reason — the same "real infrastructure follow-up, not
buildable today" posture every other unimplemented integration point in
this project takes (see Module 6/8/13/14's docs).

This file has never been deployed to a real Modal account and has never
run against a real GPU — nothing below is smoke-tested end-to-end. What
*is* verified: it parses as valid Python (`python -m py_compile`) and its
control-flow shape mirrors the honest-failure pattern used everywhere
else in this codebase.
"""

from __future__ import annotations

import os
from typing import Any

import modal

APP_NAME = "xdrama-comfyui-worker"
MODEL_VOLUME_NAME = "xdrama-model-weights"
MODELS_VOLUME_PATH = "/models"

model_volume = modal.Volume.from_name(MODEL_VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install(
        "supabase>=2.10,<3",
        "httpx>=0.27,<0.28",
        # ComfyUI itself, plus whichever custom-node packages implement
        # each of the 8 tracked models, are a real, separate installation
        # step this file does not perform — see the module docstring.
    )
)

app = modal.App(APP_NAME, image=image)


def _write(supabase: Any, job_id: str, patch: dict[str, Any]) -> None:
    supabase.table("render_jobs").update(patch).eq("id", job_id).execute()


def _stage(supabase: Any, job_id: str, stage: str) -> None:
    _write(supabase, job_id, {"stage": stage})


def _fail(supabase: Any, job_id: str, message: str) -> None:
    _write(supabase, job_id, {"status": "failed", "stage": None, "error_message": message})


def _complete(supabase: Any, job_id: str, output_asset_url: str) -> None:
    _write(
        supabase,
        job_id,
        {"status": "completed", "stage": None, "output_asset_url": output_asset_url},
    )


@app.function(
    gpu="A10G",
    volumes={MODELS_VOLUME_PATH: model_volume},
    secrets=[modal.Secret.from_name("xdrama-supabase")],
    timeout=60 * 30,
)
def generate(job_id: str, compiled_workflow: dict[str, Any]) -> None:
    """Entry point ModalComputeProvider.submit() spawns via
    `Function.from_name(APP_NAME, "generate").spawn(...)`.

    Writes its own progress directly to render_jobs.stage as it moves
    through the pipeline — the orchestrator does not poll this function;
    it only records the FunctionCall id spawn() returns, for a later
    status check or cancellation request (see AIComputeProvider.get_status/
    cancel). This function, not the orchestrator, holds the real GPU
    connection, so it is the one source of truth for its own progress —
    the same "worker reports its own state" division of responsibility
    the original architecture update asked for.

    The xdrama-supabase Modal Secret must provide SUPABASE_URL and
    SUPABASE_SERVICE_ROLE_KEY (create it with `modal secret create
    xdrama-supabase SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`) —
    the two values named in the architecture update, alongside
    MODAL_TOKEN_ID/MODAL_TOKEN_SECRET which live on the orchestrator side,
    not here.
    """
    from supabase import create_client

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    try:
        _stage(supabase, job_id, "starting")

        _stage(supabase, job_id, "downloading_models")
        _ensure_models_present(compiled_workflow)

        _stage(supabase, job_id, "generating")
        raw_output_path = _run_comfyui(compiled_workflow)

        _stage(supabase, job_id, "post_processing")
        final_path = _post_process(raw_output_path)

        _stage(supabase, job_id, "uploading")
        output_asset_url = _upload_to_supabase_storage(supabase, job_id, final_path)

        _complete(supabase, job_id, output_asset_url)
    except Exception as exc:
        # The job's own failure, reported the same honest way every
        # dispatch-time failure already is — not swallowed, and re-raised
        # so the Modal FunctionCall itself also reflects the failure for
        # anything polling get_status()/get().
        _fail(supabase, job_id, str(exc))
        raise


def _ensure_models_present(compiled_workflow: dict[str, Any]) -> None:
    """Would check MODELS_VOLUME_PATH for the weights each model_task
    node's class_type needs and download any that are missing, using
    ai_models.compute_function_name (see Module 17's migration) to know
    which model a given task_type resolved to. Not implemented:
    compute_function_name is null for every model in every environment
    this project has run in — there is no real mapping yet from a model
    to a download URL/HF repo id to act on."""
    raise NotImplementedError(
        "No model weights are configured to download yet — every ai_models row has a null "
        "compute_function_name. See docs/17-module-17-modal-gpu-compute-provider.md."
    )


def _run_comfyui(compiled_workflow: dict[str, Any]) -> str:
    """Would submit compiled_workflow to a ComfyUI instance running in
    this container and return the path to its output file. Not
    implemented: no ComfyUI installation exists in `image` above, and the
    compiled graph's class_type strings are placeholders (see the
    orchestrator's app/workflows/comfyui_compiler.py) — there is no real
    custom-node package to install and no real class_type name to submit
    against yet."""
    raise NotImplementedError("ComfyUI execution is not implemented yet")


def _post_process(raw_output_path: str) -> str:
    """Would run any final encoding/format pass (e.g. via the ffmpeg
    installed in `image`) before upload. Not implemented — there is no
    raw output to post-process yet."""
    raise NotImplementedError("Post-processing is not implemented yet")


def _upload_to_supabase_storage(supabase: Any, job_id: str, file_path: str) -> str:
    """Would upload the finished video to Supabase Storage and return its
    public/signed URL. Not implemented — there is no finished file yet."""
    raise NotImplementedError("Upload to Supabase Storage is not implemented yet")
