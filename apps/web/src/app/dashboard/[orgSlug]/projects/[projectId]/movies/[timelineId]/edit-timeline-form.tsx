"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteTimeline,
  updateTimeline,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/movies/actions";
import {
  updateTimelineSchema,
  type UpdateTimelineInput,
} from "@/lib/validations/movie-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EditTimelineForm({
  orgSlug,
  projectId,
  timeline,
}: {
  orgSlug: string;
  projectId: string;
  timeline: UpdateTimelineInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateTimelineInput>({
    resolver: zodResolver(updateTimelineSchema),
    defaultValues: timeline,
  });

  async function onSubmit(data: UpdateTimelineInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateTimeline(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (
      !window.confirm("Delete this timeline? Its clips will be deleted too.")
    ) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteTimeline(
      orgSlug,
      projectId,
      timeline.timelineId,
    );
    if (result.error) {
      setServerError(result.error);
      setIsDeleting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" {...register("timelineId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="timeline-name">Name</Label>
        <Input
          id="timeline-name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timeline-description">Description</Label>
        <Textarea
          id="timeline-description"
          rows={3}
          {...register("description")}
        />
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
          {isDeleting ? "Deleting..." : "Delete timeline"}
        </Button>
      </div>
    </form>
  );
}
