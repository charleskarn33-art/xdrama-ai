"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import { callOrchestrator, OrchestratorError } from "@/lib/orchestrator";

export type ActionResult = { error: string } | { error: null };

type ModelActionResponse = {
  ok: boolean;
  install_status?: string;
  health_status?: string;
  message: string;
};

const modelIdSchema = z.string().uuid();

export async function toggleModelEnabled(
  modelId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const parsed = modelIdSchema.safeParse(modelId);
  if (!parsed.success) {
    return { error: "Invalid model id" };
  }

  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase
    .from("ai_models")
    .update({ is_enabled: enabled })
    .eq("id", parsed.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/models");
  return { error: null };
}

async function runModelAction(
  modelId: string,
  action: "install" | "uninstall" | "health-check",
): Promise<ActionResult> {
  const parsed = modelIdSchema.safeParse(modelId);
  if (!parsed.success) {
    return { error: "Invalid model id" };
  }

  await requirePlatformAdmin();

  try {
    const result = await callOrchestrator<ModelActionResponse>(
      `/api/v1/models/${parsed.data}/${action}`,
      { method: "POST" },
    );
    revalidatePath("/admin/models");
    return result.ok ? { error: null } : { error: result.message };
  } catch (err) {
    return {
      error: err instanceof OrchestratorError ? err.message : "Request failed",
    };
  }
}

export async function installModel(modelId: string): Promise<ActionResult> {
  return runModelAction(modelId, "install");
}

export async function uninstallModel(modelId: string): Promise<ActionResult> {
  return runModelAction(modelId, "uninstall");
}

export async function healthCheckModel(modelId: string): Promise<ActionResult> {
  return runModelAction(modelId, "health-check");
}
