"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { callOrchestrator, OrchestratorError } from "@/lib/orchestrator";
import { buildReferenceArtGraph } from "@/lib/reference-art/graph";
import {
  generateReferenceArtSchema,
  type GenerateReferenceArtInput,
} from "@/lib/validations/reference-art";

export type ReferenceArtJob = {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

export type GenerateReferenceArtResult =
  { error: string } | { error: null; workflowId: string; job: ReferenceArtJob };

const JOB_SELECT = "id, status, error_message, created_at";

// Deliberately reuses Module 8's workflow/render_jobs pipeline instead of a
// separate generation path: a reference image is just an
// input -> model_task -> output workflow, run through the same tested
// graph -> compiler -> queue -> dispatch machinery every other render
// uses. One workflow per subject (enforced by a DB partial unique index)
// is found-or-created here and kept in sync with the subject's current
// text on every call, so repeated generations never go stale.
export async function generateReferenceArt(
  orgSlug: string,
  input: GenerateReferenceArtInput,
): Promise<GenerateReferenceArtResult> {
  const parsed = generateReferenceArtSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  // zod's `config: z.record(z.string(), z.unknown())` can't statically
  // prove JSON-serializability the way the generated `Json` type demands,
  // even though validate_workflow_graph() re-validates the actual shape
  // in Postgres (see the equivalent cast in the Module 8 workflows
  // actions).
  const graph = buildReferenceArtGraph(
    parsed.data.subjectType,
    parsed.data.description || "",
  ) as unknown as Json;

  const { data: existing } = await supabase
    .from("workflows")
    .select("id")
    .eq("subject_type", parsed.data.subjectType)
    .eq("subject_id", parsed.data.subjectId)
    .maybeSingle();

  let workflowId = existing?.id ?? null;

  if (workflowId) {
    const { error } = await supabase
      .from("workflows")
      .update({ graph })
      .eq("id", workflowId);
    if (error) {
      return { error: error.message };
    }
  } else {
    const { data: workflow, error } = await supabase
      .from("workflows")
      .insert({
        project_id: parsed.data.projectId,
        name: `Reference art: ${parsed.data.subjectName}`,
        graph,
        subject_type: parsed.data.subjectType,
        subject_id: parsed.data.subjectId,
      })
      .select("id")
      .single();
    if (error || !workflow) {
      return {
        error: error?.message ?? "Could not start reference art generation",
      };
    }
    workflowId = workflow.id;
  }

  const { data: job, error: jobError } = await supabase
    .from("render_jobs")
    .insert({ project_id: parsed.data.projectId, workflow_id: workflowId })
    .select(JOB_SELECT)
    .single();

  if (jobError || !job) {
    return { error: jobError?.message ?? "Could not create render job" };
  }

  revalidatePath(
    `/dashboard/${orgSlug}/projects/${parsed.data.projectId}/${parsed.data.subjectType}s/${parsed.data.subjectId}`,
  );

  try {
    await callOrchestrator<{ ok: boolean; status: string; message: string }>(
      `/api/v1/render-jobs/${job.id}/dispatch`,
      { method: "POST" },
    );
  } catch (err) {
    return {
      error:
        err instanceof OrchestratorError
          ? err.message
          : "Dispatch request failed",
    };
  }

  // Dispatch may have synchronously updated the job's status (e.g. to
  // 'failed' with an honest error message when no render nodes are
  // configured). Re-fetch so the caller gets the authoritative row
  // instead of the pre-dispatch 'queued' snapshot — a Realtime
  // subscription set up only after this action returns would otherwise
  // miss that update entirely.
  const { data: refreshed } = await supabase
    .from("render_jobs")
    .select(JOB_SELECT)
    .eq("id", job.id)
    .single();

  return { error: null, workflowId, job: refreshed ?? job };
}
