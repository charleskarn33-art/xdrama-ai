"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createScriptSchema,
  deleteScriptSchema,
  updateScriptSchema,
  type CreateScriptInput,
  type UpdateScriptInput,
} from "@/lib/validations/scripts";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}`;
}

export async function createScript(
  orgSlug: string,
  input: CreateScriptInput,
): Promise<ActionResult> {
  const parsed = createScriptSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: script, error } = await supabase
    .from("scripts")
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      content: parsed.data.content || "",
    })
    .select("id")
    .single();

  if (error || !script) {
    return { error: error?.message ?? "Could not create script" };
  }

  revalidatePath(`${basePath(orgSlug, parsed.data.projectId)}/scripts`);
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/scripts/${script.id}`);
}

export async function updateScript(
  orgSlug: string,
  projectId: string,
  input: UpdateScriptInput,
): Promise<ActionResult> {
  const parsed = updateScriptSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("scripts")
    .update({
      title: parsed.data.title,
      content: parsed.data.content || "",
      status: parsed.data.status,
    })
    .eq("id", parsed.data.scriptId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/scripts`);
  return { error: null };
}

export async function deleteScript(
  orgSlug: string,
  projectId: string,
  scriptId: string,
): Promise<ActionResult> {
  const parsed = deleteScriptSchema.safeParse({ scriptId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("scripts")
    .delete({ count: "exact" })
    .eq("id", parsed.data.scriptId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this script." };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/scripts`);
  redirect(`${basePath(orgSlug, projectId)}/scripts`);
}
