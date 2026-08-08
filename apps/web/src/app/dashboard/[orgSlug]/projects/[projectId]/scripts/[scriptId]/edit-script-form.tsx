"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteScript,
  updateScript,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/scripts/actions";
import {
  SCRIPT_STATUSES,
  updateScriptSchema,
  type UpdateScriptInput,
} from "@/lib/validations/scripts";
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

const STATUS_LABEL: Record<(typeof SCRIPT_STATUSES)[number], string> = {
  draft: "Draft",
  final: "Final",
};

export function EditScriptForm({
  orgSlug,
  projectId,
  script,
}: {
  orgSlug: string;
  projectId: string;
  script: UpdateScriptInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateScriptInput>({
    resolver: zodResolver(updateScriptSchema),
    defaultValues: script,
  });

  async function onSubmit(data: UpdateScriptInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateScript(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this script? This cannot be undone.")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteScript(orgSlug, projectId, script.scriptId);
    if (result.error) {
      setServerError(result.error);
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("scriptId")} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="script-title">Title</Label>
          <Input id="script-title" aria-invalid={!!errors.title} {...register("title")} />
        </div>

        <div className="flex flex-col gap-2 sm:w-40">
          <Label htmlFor="script-status">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="script-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCRIPT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      {errors.title && (
        <p className="text-destructive text-sm">{errors.title.message}</p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="script-content">Content</Label>
        <Textarea
          id="script-content"
          rows={20}
          className="font-mono text-sm"
          {...register("content")}
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
          {isDeleting ? "Deleting..." : "Delete script"}
        </Button>
      </div>
    </form>
  );
}
