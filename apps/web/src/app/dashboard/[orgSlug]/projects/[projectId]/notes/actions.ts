"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createNoteSchema,
  deleteNoteSchema,
  updateNoteSchema,
  type CreateNoteInput,
  type UpdateNoteInput,
} from "@/lib/validations/story-bible";

export type ActionResult = { error: string } | { error: null };

function basePath(orgSlug: string, projectId: string) {
  return `/dashboard/${orgSlug}/projects/${projectId}`;
}

export async function createNote(
  orgSlug: string,
  input: CreateNoteInput,
): Promise<ActionResult> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from("story_bible_notes")
    .insert({
      project_id: parsed.data.projectId,
      title: parsed.data.title,
      content: parsed.data.content || null,
    })
    .select("id")
    .single();

  if (error || !note) {
    return { error: error?.message ?? "Could not create note" };
  }

  revalidatePath(`${basePath(orgSlug, parsed.data.projectId)}/notes`);
  redirect(`${basePath(orgSlug, parsed.data.projectId)}/notes/${note.id}`);
}

export async function updateNote(
  orgSlug: string,
  projectId: string,
  input: UpdateNoteInput,
): Promise<ActionResult> {
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("story_bible_notes")
    .update({
      title: parsed.data.title,
      content: parsed.data.content || null,
    })
    .eq("id", parsed.data.noteId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/notes`);
  return { error: null };
}

export async function deleteNote(
  orgSlug: string,
  projectId: string,
  noteId: string,
): Promise<ActionResult> {
  const parsed = deleteNoteSchema.safeParse({ noteId });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("story_bible_notes")
    .delete({ count: "exact" })
    .eq("id", parsed.data.noteId);

  if (error) {
    return { error: error.message };
  }
  if (!count) {
    return { error: "You don't have permission to delete this note." };
  }

  revalidatePath(`${basePath(orgSlug, projectId)}/notes`);
  redirect(`${basePath(orgSlug, projectId)}/notes`);
}
