"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteNote,
  updateNote,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/notes/actions";
import { updateNoteSchema, type UpdateNoteInput } from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EditNoteForm({
  orgSlug,
  projectId,
  note,
}: {
  orgSlug: string;
  projectId: string;
  note: UpdateNoteInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateNoteInput>({
    resolver: zodResolver(updateNoteSchema),
    defaultValues: note,
  });

  async function onSubmit(data: UpdateNoteInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateNote(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this note?")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteNote(orgSlug, projectId, note.noteId);
    if (result.error) {
      setServerError(result.error);
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("noteId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="note-title">Title</Label>
        <Input id="note-title" aria-invalid={!!errors.title} {...register("title")} />
        {errors.title && (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="note-content">Content</Label>
        <Textarea id="note-content" rows={8} {...register("content")} />
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      {saved && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={isDeleting}
          onClick={onDelete}
        >
          {isDeleting ? "Deleting..." : "Delete note"}
        </Button>
      </div>
    </form>
  );
}
