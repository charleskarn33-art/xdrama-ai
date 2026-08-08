"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createCharacterSchema,
  createRelationshipSchema,
  deleteCharacterSchema,
  deleteRelationshipSchema,
  updateCharacterSchema,
  type CreateCharacterInput,
  type CreateRelationshipInput,
  type UpdateCharacterInput,
} from "@/lib/validations/story-bible";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}`;
}

export async function createCharacter(
  orgSlug: string,
  input: CreateCharacterInput,
): Promise<ActionResult> {
  const parsed = createCharacterSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: character, error } = await supabase
    .from("characters")
    .insert({
      project_id: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      appearance: parsed.data.appearance || null,
      personality: parsed.data.personality || null,
      voice_description: parsed.data.voiceDescription || null,
    })
    .select("id")
    .single();

  if (error || !character) {
    return { error: error?.message ?? "Could not create character" };
  }

  revalidatePath(`${basePath(orgSlug, parsed.data.projectId)}/characters`);
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/characters/${character.id}`);
}

export async function updateCharacter(
  orgSlug: string,
  projectId: string,
  input: UpdateCharacterInput,
): Promise<ActionResult> {
  const parsed = updateCharacterSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("characters")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      appearance: parsed.data.appearance || null,
      personality: parsed.data.personality || null,
      voice_description: parsed.data.voiceDescription || null,
    })
    .eq("id", parsed.data.characterId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/characters`);
  return { error: null };
}

export async function deleteCharacter(
  orgSlug: string,
  projectId: string,
  characterId: string,
): Promise<ActionResult> {
  const parsed = deleteCharacterSchema.safeParse({ characterId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("characters")
    .delete({ count: "exact" })
    .eq("id", parsed.data.characterId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this character." };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/characters`);
  redirect(`${basePath(orgSlug, projectId)}/characters`);
}

export async function createRelationship(
  orgSlug: string,
  projectId: string,
  input: CreateRelationshipInput,
): Promise<ActionResult> {
  const parsed = createRelationshipSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("character_relationships").insert({
    character_id: parsed.data.characterId,
    related_character_id: parsed.data.relatedCharacterId,
    relationship_type: parsed.data.relationshipType,
    description: parsed.data.description || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/characters/${parsed.data.characterId}`);
  return { error: null };
}

export async function deleteRelationship(
  orgSlug: string,
  projectId: string,
  characterId: string,
  relationshipId: string,
): Promise<ActionResult> {
  const parsed = deleteRelationshipSchema.safeParse({ relationshipId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("character_relationships")
    .delete()
    .eq("id", parsed.data.relationshipId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/characters/${characterId}`);
  return { error: null };
}
