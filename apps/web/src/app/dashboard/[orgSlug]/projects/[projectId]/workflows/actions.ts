"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { callOrchestrator, OrchestratorError } from "@/lib/orchestrator";
import {
  createRenderJobSchema,
  createWorkflowFromTemplateSchema,
  deleteWorkflowSchema,
  updateWorkflowSchema,
  type CreateRenderJobInput,
  type CreateWorkflowFromTemplateInput,
  type UpdateWorkflowInput,
} from "@/lib/validations/workflows";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}/workflows`;
}

export async function createWorkflowFromTemplate(
  orgSlug: string,
  input: CreateWorkflowFromTemplateInput,
): Promise<ActionResult> {
  const parsed = createWorkflowFromTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  const { data: template, error: templateError } = await supabase
    .from("workflow_templates")
    .select("graph")
    .eq("id", parsed.data.templateId)
    .single();

  if (templateError || !template) {
    return { error: templateError?.message ?? "Template not found" };
  }

  const { data: workflow, error } = await supabase
    .from("workflows")
    .insert({
      project_id: parsed.data.projectId,
      name: parsed.data.name,
      graph: template.graph,
      source_template_id: parsed.data.templateId,
    })
    .select("id")
    .single();

  if (error || !workflow) {
    return { error: error?.message ?? "Could not create workflow" };
  }

  revalidatePath(basePath(orgSlug, parsed.data.projectId));
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/${workflow.id}`);
}

export async function updateWorkflow(
  orgSlug: string,
  projectId: string,
  input: UpdateWorkflowInput,
): Promise<ActionResult> {
  const parsed = updateWorkflowSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const patch: Database["public"]["Tables"]["workflows"]["Update"] = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  // zod's `config: z.record(z.string(), z.unknown())` can't statically
  // prove JSON-serializability the way the generated `Json` type demands,
  // even though validate_workflow_graph() re-validates the actual shape
  // in Postgres.
  if (parsed.data.graph !== undefined)
    patch.graph = parsed.data
      .graph as Database["public"]["Tables"]["workflows"]["Update"]["graph"];

  const { error } = await supabase
    .from("workflows")
    .update(patch)
    .eq("id", parsed.data.workflowId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${parsed.data.workflowId}`);
  return { error: null };
}

export async function deleteWorkflow(
  orgSlug: string,
  projectId: string,
  workflowId: string,
): Promise<ActionResult> {
  const parsed = deleteWorkflowSchema.safeParse({ workflowId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("workflows")
    .delete({ count: "exact" })
    .eq("id", parsed.data.workflowId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this workflow." };
  }

  revalidatePath(basePath(orgSlug, projectId));
  redirect(basePath(orgSlug, projectId));
}

export async function createAndDispatchRenderJob(
  orgSlug: string,
  input: CreateRenderJobInput,
): Promise<ActionResult> {
  const parsed = createRenderJobSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("render_jobs")
    .insert({
      project_id: parsed.data.projectId,
      workflow_id: parsed.data.workflowId,
    })
    .select("id")
    .single();

  if (error || !job) {
    return { error: error?.message ?? "Could not create render job" };
  }

  try {
    const result = await callOrchestrator<{ ok: boolean; message: string }>(
      `/api/v1/render-jobs/${job.id}/dispatch`,
      { method: "POST" },
    );
    revalidatePath(
      `${basePath(orgSlug, parsed.data.projectId)}/${parsed.data.workflowId}`,
    );
    return result.ok ? { error: null } : { error: result.message };
  } catch (err) {
    return {
      error:
        err instanceof OrchestratorError
          ? err.message
          : "Dispatch request failed",
    };
  }
}
