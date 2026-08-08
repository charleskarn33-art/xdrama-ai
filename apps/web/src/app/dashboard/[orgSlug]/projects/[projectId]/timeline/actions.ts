"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createTimelineEventSchema,
  deleteTimelineEventSchema,
  type CreateTimelineEventInput,
} from "@/lib/validations/story-bible";

export type ActionResult = { error: string } | { error: null };

export async function createTimelineEvent(
  orgSlug: string,
  input: CreateTimelineEventInput,
): Promise<ActionResult> {
  const parsed = createTimelineEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("timeline_events").insert({
    project_id: parsed.data.projectId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    in_story_date: parsed.data.inStoryDate || null,
    event_order: parsed.data.eventOrder,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/${orgSlug}/projects/${parsed.data.projectId}/timeline`);
  return { error: null };
}

export async function deleteTimelineEvent(
  orgSlug: string,
  projectId: string,
  eventId: string,
): Promise<ActionResult> {
  const parsed = deleteTimelineEventSchema.safeParse({ eventId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("timeline_events")
    .delete()
    .eq("id", parsed.data.eventId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/${orgSlug}/projects/${projectId}/timeline`);
  return { error: null };
}
