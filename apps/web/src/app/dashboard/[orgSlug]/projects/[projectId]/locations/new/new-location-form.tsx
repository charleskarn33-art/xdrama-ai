"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createLocation } from "@/app/dashboard/[orgSlug]/projects/[projectId]/locations/actions";
import {
  createLocationSchema,
  type CreateLocationInput,
} from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewLocationForm({
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
  } = useForm<CreateLocationInput>({
    resolver: zodResolver(createLocationSchema),
    defaultValues: { projectId, name: "" },
  });

  async function onSubmit(data: CreateLocationInput) {
    setServerError(null);
    const result = await createLocation(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("projectId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="location-name">Name</Label>
        <Input id="location-name" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="location-description">Description</Label>
        <Textarea id="location-description" rows={4} {...register("description")} />
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create location"}
      </Button>
    </form>
  );
}
