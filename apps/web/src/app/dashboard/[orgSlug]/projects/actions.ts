"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createProjectSchema,
  deleteProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type DeleteProjectInput,
  type UpdateProjectInput,
} from "@/lib/validations/projects";

export type ActionResult = { error: string } | { error: null };

export async function createProject(
  orgSlug: string,
  input: CreateProjectInput,
): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: parsed.data.orgId,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { error: error?.message ?? "Could not create project" };
  }

  revalidatePath(`/dashboard/${orgSlug}/projects`);
  redirect(`/dashboard/${orgSlug}/projects/${project.id}`);
}

export async function updateProject(
  orgSlug: string,
  input: UpdateProjectInput,
): Promise<ActionResult> {
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/${orgSlug}/projects`);
  revalidatePath(`/dashboard/${orgSlug}/projects/${parsed.data.projectId}`);
  return { error: null };
}

export async function deleteProject(
  orgSlug: string,
  input: DeleteProjectInput,
): Promise<ActionResult> {
  const parsed = deleteProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("projects")
    .delete({ count: "exact" })
    .eq("id", parsed.data.projectId);

  if (error) {
    return { error: error.message };
  }

  if (!count) {
    return {
      error: "You don't have permission to delete this project.",
    };
  }

  revalidatePath(`/dashboard/${orgSlug}/projects`);
  redirect(`/dashboard/${orgSlug}/projects`);
}
