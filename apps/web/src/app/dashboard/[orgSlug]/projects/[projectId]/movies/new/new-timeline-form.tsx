"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createTimeline } from "@/app/dashboard/[orgSlug]/projects/[projectId]/movies/actions";
import {
  createTimelineSchema,
  type CreateTimelineInput,
} from "@/lib/validations/movie-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewTimelineForm({
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
  } = useForm<CreateTimelineInput>({
    resolver: zodResolver(createTimelineSchema),
    defaultValues: { projectId, name: "" },
  });

  async function onSubmit(data: CreateTimelineInput) {
    setServerError(null);
    const result = await createTimeline(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" {...register("projectId")} />

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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create timeline"}
      </Button>
    </form>
  );
}
