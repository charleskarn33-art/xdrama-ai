"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { callOrchestrator, OrchestratorError } from "@/lib/orchestrator";
import {
  createExportJobSchema,
  type CreateExportJobInput,
} from "@/lib/validations/export-studio";

export type ExportJob = {
  id: string;
  status: string;
  output_asset_url: string | null;
  error_message: string | null;
  created_at: string;
  timeline_id: string;
  preset_id: string | null;
};

export type CreateExportJobResult =
  { error: string } | { error: null; job: ExportJob };

const JOB_SELECT =
  "id, status, output_asset_url, error_message, created_at, timeline_id, preset_id";

export async function createAndDispatchExportJob(
  orgSlug: string,
  input: CreateExportJobInput,
): Promise<CreateExportJobResult> {
  const parsed = createExportJobSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("export_jobs")
    .insert({
      timeline_id: parsed.data.timelineId,
      preset_id: parsed.data.presetId || null,
    })
    .select(JOB_SELECT)
    .single();

  if (error || !job) {
    return { error: error?.message ?? "Could not create export job" };
  }

  revalidatePath(
    `/dashboard/${orgSlug}/projects/${parsed.data.projectId}/export`,
  );

  try {
    await callOrchestrator<{ ok: boolean; status: string; message: string }>(
      `/api/v1/export-jobs/${job.id}/dispatch`,
      { method: "POST" },
    );
  } catch (err) {
    return {
      error:
        err instanceof OrchestratorError
          ? err.message
          : "Export request failed",
    };
  }

  // Dispatch may have synchronously updated the job's status (e.g. to
  // 'failed' with an honest error message when there's no rendered
  // clip to export). Re-fetch so the caller gets the authoritative row.
  const { data: refreshed } = await supabase
    .from("export_jobs")
    .select(JOB_SELECT)
    .eq("id", job.id)
    .single();

  return { error: null, job: refreshed ?? job };
}
