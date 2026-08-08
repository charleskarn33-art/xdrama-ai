"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteProject,
  updateProject,
} from "@/app/dashboard/[orgSlug]/projects/actions";
import {
  PROJECT_STATUSES,
  updateProjectSchema,
  type UpdateProjectInput,
} from "@/lib/validations/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABEL: Record<(typeof PROJECT_STATUSES)[number], string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

export function EditProjectForm({
  orgSlug,
  project,
  canDelete,
}: {
  orgSlug: string;
  project: UpdateProjectInput;
  canDelete: boolean;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: project,
  });

  async function onSubmit(data: UpdateProjectInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateProject(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this project? This cannot be undone.")) {
      return;
    }
    setIsDeleting(true);
    setServerError(null);
    const result = await deleteProject(orgSlug, { projectId: project.projectId });
    if (result.error) {
      setServerError(result.error);
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("projectId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-name">Name</Label>
        <Input id="edit-name" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          rows={4}
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-destructive text-sm">{errors.description.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-status">Status</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="edit-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
        {canDelete && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting ? "Deleting..." : "Delete project"}
          </Button>
        )}
      </div>
    </form>
  );
}
