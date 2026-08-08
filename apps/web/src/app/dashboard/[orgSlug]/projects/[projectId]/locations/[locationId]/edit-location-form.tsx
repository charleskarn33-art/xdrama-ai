"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteLocation,
  updateLocation,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/locations/actions";
import {
  updateLocationSchema,
  type UpdateLocationInput,
} from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EditLocationForm({
  orgSlug,
  projectId,
  location,
}: {
  orgSlug: string;
  projectId: string;
  location: UpdateLocationInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateLocationInput>({
    resolver: zodResolver(updateLocationSchema),
    defaultValues: location,
  });

  async function onSubmit(data: UpdateLocationInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateLocation(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this location?")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteLocation(orgSlug, projectId, location.locationId);
    if (result.error) {
      setServerError(result.error);
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("locationId")} />

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
          {isDeleting ? "Deleting..." : "Delete location"}
        </Button>
      </div>
    </form>
  );
}
