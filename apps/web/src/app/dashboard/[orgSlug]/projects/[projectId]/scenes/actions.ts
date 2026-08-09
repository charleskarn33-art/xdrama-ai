"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  addShotCharacterSchema,
  createSceneSchema,
  createShotSchema,
  deleteSceneSchema,
  deleteShotSchema,
  removeShotCharacterSchema,
  updateSceneSchema,
  updateShotSchema,
  type AddShotCharacterInput,
  type CreateSceneInput,
  type CreateShotInput,
  type UpdateSceneInput,
  type UpdateShotInput,
} from "@/lib/validations/storyboard";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}/scenes`;
}

export async function createScene(
  orgSlug: string,
  input: CreateSceneInput,
): Promise<ActionResult> {
  const parsed = createSceneSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: scene, error } = await supabase
    .from("scenes")
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      scene_order: parsed.data.sceneOrder,
      script_id: parsed.data.scriptId || null,
      location_id: parsed.data.locationId || null,
    })
    .select("id")
    .single();

  if (error || !scene) {
    return { error: error?.message ?? "Could not create scene" };
  }

  revalidatePath(basePath(orgSlug, parsed.data.projectId));
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/${scene.id}`);
}

export async function updateScene(
  orgSlug: string,
  projectId: string,
  input: UpdateSceneInput,
): Promise<ActionResult> {
  const parsed = updateSceneSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("scenes")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      scene_order: parsed.data.sceneOrder,
      script_id: parsed.data.scriptId || null,
      location_id: parsed.data.locationId || null,
    })
    .eq("id", parsed.data.sceneId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${parsed.data.sceneId}`);
  return { error: null };
}

export async function deleteScene(
  orgSlug: string,
  projectId: string,
  sceneId: string,
): Promise<ActionResult> {
  const parsed = deleteSceneSchema.safeParse({ sceneId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("scenes")
    .delete({ count: "exact" })
    .eq("id", parsed.data.sceneId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this scene." };
  }

  revalidatePath(basePath(orgSlug, projectId));
  redirect(basePath(orgSlug, projectId));
}

export async function createShot(
  orgSlug: string,
  projectId: string,
  input: CreateShotInput,
): Promise<ActionResult> {
  const parsed = createShotSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shots").insert({
    scene_id: parsed.data.sceneId,
    shot_order: parsed.data.shotOrder,
    shot_type: parsed.data.shotType || null,
    description: parsed.data.description,
    duration_seconds: parsed.data.durationSeconds ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${parsed.data.sceneId}`);
  return { error: null };
}

export async function updateShot(
  orgSlug: string,
  projectId: string,
  sceneId: string,
  input: UpdateShotInput,
): Promise<ActionResult> {
  const parsed = updateShotSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shots")
    .update({
      shot_order: parsed.data.shotOrder,
      shot_type: parsed.data.shotType || null,
      description: parsed.data.description,
      duration_seconds: parsed.data.durationSeconds ?? null,
    })
    .eq("id", parsed.data.shotId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(
    `${basePath(orgSlug, projectId)}/${sceneId}/shots/${parsed.data.shotId}`,
  );
  return { error: null };
}

export async function deleteShot(
  orgSlug: string,
  projectId: string,
  sceneId: string,
  shotId: string,
): Promise<ActionResult> {
  const parsed = deleteShotSchema.safeParse({ shotId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("shots")
    .delete({ count: "exact" })
    .eq("id", parsed.data.shotId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this shot." };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${sceneId}`);
  redirect(`${basePath(orgSlug, projectId)}/${sceneId}`);
}

export async function addShotCharacter(
  orgSlug: string,
  projectId: string,
  sceneId: string,
  input: AddShotCharacterInput,
): Promise<ActionResult> {
  const parsed = addShotCharacterSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shot_characters").insert({
    shot_id: parsed.data.shotId,
    character_id: parsed.data.characterId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(
    `${basePath(orgSlug, projectId)}/${sceneId}/shots/${parsed.data.shotId}`,
  );
  return { error: null };
}

export async function removeShotCharacter(
  orgSlug: string,
  projectId: string,
  sceneId: string,
  shotId: string,
  characterId: string,
): Promise<ActionResult> {
  const parsed = removeShotCharacterSchema.safeParse({ shotId, characterId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shot_characters")
    .delete()
    .eq("shot_id", parsed.data.shotId)
    .eq("character_id", parsed.data.characterId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${sceneId}/shots/${shotId}`);
  return { error: null };
}
