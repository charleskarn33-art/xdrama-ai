"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createNote } from "@/app/dashboard/[orgSlug]/projects/[projectId]/notes/actions";
import { createNoteSchema, type CreateNoteInput } from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewNoteForm({
  orgSlug,
  projectId,
}: {
  orgSlug: string;
  projectId: string;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateNoteInput>({
    resolver: zodResolver(createNoteSchema),
    defaultValues: { projectId, title: "" },
  });

  async function onSubmit(data: CreateNoteInput) {
    setServerError(null);
    const result = await createNote(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("projectId")} />

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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create note"}
      </Button>
    </form>
  );
}
