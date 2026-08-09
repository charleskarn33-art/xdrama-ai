"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  addClipSchema,
  createTimelineSchema,
  deleteClipSchema,
  deleteTimelineSchema,
  updateClipSchema,
  updateTimelineSchema,
  type AddClipInput,
  type CreateTimelineInput,
  type UpdateClipInput,
  type UpdateTimelineInput,
} from "@/lib/validations/movie-composer";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}/movies`;
}

export async function createTimeline(
  orgSlug: string,
  input: CreateTimelineInput,
): Promise<ActionResult> {
  const parsed = createTimelineSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: timeline, error } = await supabase
    .from("movie_timelines")
    .insert({
      project_id: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error || !timeline) {
    return { error: error?.message ?? "Could not create timeline" };
  }

  revalidatePath(basePath(orgSlug, parsed.data.projectId));
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/${timeline.id}`);
}

export async function updateTimeline(
  orgSlug: string,
  projectId: string,
  input: UpdateTimelineInput,
): Promise<ActionResult> {
  const parsed = updateTimelineSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("movie_timelines")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq("id", parsed.data.timelineId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${parsed.data.timelineId}`);
  return { error: null };
}

export async function deleteTimeline(
  orgSlug: string,
  projectId: string,
  timelineId: string,
): Promise<ActionResult> {
  const parsed = deleteTimelineSchema.safeParse({ timelineId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("movie_timelines")
    .delete({ count: "exact" })
    .eq("id", parsed.data.timelineId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this timeline." };
  }

  revalidatePath(basePath(orgSlug, projectId));
  redirect(basePath(orgSlug, projectId));
}

export async function addClip(
  orgSlug: string,
  projectId: string,
  input: AddClipInput,
): Promise<ActionResult> {
  const parsed = addClipSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("timeline_clips").insert({
    timeline_id: parsed.data.timelineId,
    shot_id: parsed.data.shotId,
    clip_order: parsed.data.clipOrder,
    transition_in: parsed.data.transitionIn,
    trim_start_seconds: parsed.data.trimStartSeconds ?? null,
    trim_end_seconds: parsed.data.trimEndSeconds ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${parsed.data.timelineId}`);
  return { error: null };
}

export async function updateClip(
  orgSlug: string,
  projectId: string,
  timelineId: string,
  input: UpdateClipInput,
): Promise<ActionResult> {
  const parsed = updateClipSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("timeline_clips")
    .update({
      clip_order: parsed.data.clipOrder,
      transition_in: parsed.data.transitionIn,
      trim_start_seconds: parsed.data.trimStartSeconds ?? null,
      trim_end_seconds: parsed.data.trimEndSeconds ?? null,
    })
    .eq("id", parsed.data.clipId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${timelineId}`);
  return { error: null };
}

export async function deleteClip(
  orgSlug: string,
  projectId: string,
  timelineId: string,
  clipId: string,
): Promise<ActionResult> {
  const parsed = deleteClipSchema.safeParse({ clipId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("timeline_clips")
    .delete({ count: "exact" })
    .eq("id", parsed.data.clipId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to remove this clip." };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/${timelineId}`);
  return { error: null };
}
