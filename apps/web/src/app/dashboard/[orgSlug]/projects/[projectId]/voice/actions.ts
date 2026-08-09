"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createVoiceLineSchema,
  deleteVoiceLineSchema,
  updateVoiceLineSchema,
  type CreateVoiceLineInput,
  type UpdateVoiceLineInput,
} from "@/lib/validations/audio-studio";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}/voice`;
}

export async function createVoiceLine(
  orgSlug: string,
  input: CreateVoiceLineInput,
): Promise<ActionResult> {
  const parsed = createVoiceLineSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: voiceLine, error } = await supabase
    .from("voice_lines")
    .insert({
      project_id: parsed.data.projectId,
      character_id: parsed.data.characterId || null,
      shot_id: parsed.data.shotId || null,
      line_order: parsed.data.lineOrder,
      text: parsed.data.text,
    })
    .select("id")
    .single();

  if (error || !voiceLine) {
    return { error: error?.message ?? "Could not create voice line" };
  }

  revalidatePath(basePath(orgSlug, parsed.data.projectId));
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/${voiceLine.id}`);
}

export async function updateVoiceLine(
  orgSlug: string,
  projectId: string,
  input: UpdateVoiceLineInput,
): Promise<ActionResult> {
  const parsed = updateVoiceLineSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("voice_lines")
    .update({
      character_id: parsed.data.characterId || null,
      shot_id: parsed.data.shotId || null,
      line_order: parsed.data.lineOrder,
      text: parsed.data.text,
    })
    .eq("id", parsed.data.voiceLineId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${parsed.data.voiceLineId}`);
  return { error: null };
}

export async function deleteVoiceLine(
  orgSlug: string,
  projectId: string,
  voiceLineId: string,
): Promise<ActionResult> {
  const parsed = deleteVoiceLineSchema.safeParse({ voiceLineId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("voice_lines")
    .delete({ count: "exact" })
    .eq("id", parsed.data.voiceLineId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this voice line." };
  }

  revalidatePath(basePath(orgSlug, projectId));
  redirect(basePath(orgSlug, projectId));
}
