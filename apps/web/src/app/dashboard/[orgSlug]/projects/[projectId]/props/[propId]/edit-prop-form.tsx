"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteProp,
  updateProp,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/props/actions";
import {
  updatePropSchema,
  type UpdatePropInput,
} from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EditPropForm({
  orgSlug,
  projectId,
  prop,
}: {
  orgSlug: string;
  projectId: string;
  prop: UpdatePropInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePropInput>({
    resolver: zodResolver(updatePropSchema),
    defaultValues: prop,
  });

  async function onSubmit(data: UpdatePropInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateProp(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this prop?")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteProp(orgSlug, projectId, prop.propId);
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
      <input type="hidden" {...register("propId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-name">Name</Label>
        <Input
          id="prop-name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-description">Description</Label>
        <Textarea id="prop-description" rows={3} {...register("description")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-appearance">Appearance</Label>
        <Textarea id="prop-appearance" rows={3} {...register("appearance")} />
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
          {isDeleting ? "Deleting..." : "Delete prop"}
        </Button>
      </div>
    </form>
  );
}
