"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createPropSchema,
  deletePropSchema,
  updatePropSchema,
  type CreatePropInput,
  type UpdatePropInput,
} from "@/lib/validations/story-bible";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}`;
}

export async function createProp(
  orgSlug: string,
  input: CreatePropInput,
): Promise<ActionResult> {
  const parsed = createPropSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: prop, error } = await supabase
    .from("props")
    .insert({
      project_id: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      appearance: parsed.data.appearance || null,
    })
    .select("id")
    .single();

  if (error || !prop) {
    return { error: error?.message ?? "Could not create prop" };
  }

  revalidatePath(`${basePath(orgSlug, parsed.data.projectId)}/props`);
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/props/${prop.id}`);
}

export async function updateProp(
  orgSlug: string,
  projectId: string,
  input: UpdatePropInput,
): Promise<ActionResult> {
  const parsed = updatePropSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("props")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      appearance: parsed.data.appearance || null,
    })
    .eq("id", parsed.data.propId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/props`);
  return { error: null };
}

export async function deleteProp(
  orgSlug: string,
  projectId: string,
  propId: string,
): Promise<ActionResult> {
  const parsed = deletePropSchema.safeParse({ propId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("props")
    .delete({ count: "exact" })
    .eq("id", parsed.data.propId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this prop." };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/props`);
  redirect(`${basePath(orgSlug, projectId)}/props`);
}
