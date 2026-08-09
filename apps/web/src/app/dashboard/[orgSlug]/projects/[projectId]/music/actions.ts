"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createMusicTrackSchema,
  deleteMusicTrackSchema,
  updateMusicTrackSchema,
  type CreateMusicTrackInput,
  type UpdateMusicTrackInput,
} from "@/lib/validations/audio-studio";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}/music`;
}

export async function createMusicTrack(
  orgSlug: string,
  input: CreateMusicTrackInput,
): Promise<ActionResult> {
  const parsed = createMusicTrackSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: track, error } = await supabase
    .from("music_tracks")
    .insert({
      project_id: parsed.data.projectId,
      scene_id: parsed.data.sceneId || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error || !track) {
    return { error: error?.message ?? "Could not create music track" };
  }

  revalidatePath(basePath(orgSlug, parsed.data.projectId));
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/${track.id}`);
}

export async function updateMusicTrack(
  orgSlug: string,
  projectId: string,
  input: UpdateMusicTrackInput,
): Promise<ActionResult> {
  const parsed = updateMusicTrackSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("music_tracks")
    .update({
      scene_id: parsed.data.sceneId || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq("id", parsed.data.musicTrackId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${parsed.data.musicTrackId}`);
  return { error: null };
}

export async function deleteMusicTrack(
  orgSlug: string,
  projectId: string,
  musicTrackId: string,
): Promise<ActionResult> {
  const parsed = deleteMusicTrackSchema.safeParse({ musicTrackId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("music_tracks")
    .delete({ count: "exact" })
    .eq("id", parsed.data.musicTrackId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this music track." };
  }

  revalidatePath(basePath(orgSlug, projectId));
  redirect(basePath(orgSlug, projectId));
}
