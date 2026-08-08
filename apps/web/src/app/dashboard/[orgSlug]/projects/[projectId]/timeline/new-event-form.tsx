"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createTimelineEvent } from "@/app/dashboard/[orgSlug]/projects/[projectId]/timeline/actions";
import {
  createTimelineEventSchema,
  type CreateTimelineEventInput,
} from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewEventForm({
  orgSlug,
  projectId,
  nextOrder,
}: {
  orgSlug: string;
  projectId: string;
  nextOrder: number;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTimelineEventInput>({
    resolver: zodResolver(createTimelineEventSchema),
    defaultValues: { projectId, title: "", inStoryDate: "", eventOrder: nextOrder },
  });

  async function onSubmit(data: CreateTimelineEventInput) {
    setServerError(null);
    const result = await createTimelineEvent(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      reset({ projectId, title: "", inStoryDate: "", eventOrder: nextOrder + 1 });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <input type="hidden" {...register("projectId")} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="event-title">Event</Label>
          <Input id="event-title" aria-invalid={!!errors.title} {...register("title")} />
        </div>

        <div className="flex flex-col gap-2 sm:w-40">
          <Label htmlFor="event-date">In-story date</Label>
          <Input id="event-date" placeholder="Day 1, Year 3042..." {...register("inStoryDate")} />
        </div>

        <div className="flex flex-col gap-2 sm:w-24">
          <Label htmlFor="event-order">Order</Label>
          <Input
            id="event-order"
            type="number"
            {...register("eventOrder", { valueAsNumber: true })}
          />
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add"}
        </Button>
      </div>

      {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
    </form>
  );
}
