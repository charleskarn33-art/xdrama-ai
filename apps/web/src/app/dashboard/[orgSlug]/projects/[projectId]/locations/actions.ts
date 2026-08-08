"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createLocationSchema,
  deleteLocationSchema,
  updateLocationSchema,
  type CreateLocationInput,
  type UpdateLocationInput,
} from "@/lib/validations/story-bible";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}`;
}

export async function createLocation(
  orgSlug: string,
  input: CreateLocationInput,
): Promise<ActionResult> {
  const parsed = createLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: location, error } = await supabase
    .from("locations")
    .insert({
      project_id: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error || !location) {
    return { error: error?.message ?? "Could not create location" };
  }

  revalidatePath(`${basePath(orgSlug, parsed.data.projectId)}/locations`);
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/locations/${location.id}`);
}

export async function updateLocation(
  orgSlug: string,
  projectId: string,
  input: UpdateLocationInput,
): Promise<ActionResult> {
  const parsed = updateLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq("id", parsed.data.locationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/locations`);
  return { error: null };
}

export async function deleteLocation(
  orgSlug: string,
  projectId: string,
  locationId: string,
): Promise<ActionResult> {
  const parsed = deleteLocationSchema.safeParse({ locationId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("locations")
    .delete({ count: "exact" })
    .eq("id", parsed.data.locationId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this location." };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/locations`);
  redirect(`${basePath(orgSlug, projectId)}/locations`);
}
