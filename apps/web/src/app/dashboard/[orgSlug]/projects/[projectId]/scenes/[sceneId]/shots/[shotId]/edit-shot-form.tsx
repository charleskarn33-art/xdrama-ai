"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteShot,
  updateShot,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/scenes/actions";
import {
  SHOT_TYPES,
  updateShotSchema,
  type UpdateShotInput,
} from "@/lib/validations/storyboard";
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

const NONE = "none";

const SHOT_TYPE_LABEL: Record<(typeof SHOT_TYPES)[number], string> = {
  wide: "Wide",
  medium: "Medium",
  close_up: "Close-up",
  extreme_close_up: "Extreme close-up",
  pov: "POV",
  over_the_shoulder: "Over the shoulder",
  aerial: "Aerial",
};

export function EditShotForm({
  orgSlug,
  projectId,
  sceneId,
  shot,
}: {
  orgSlug: string;
  projectId: string;
  sceneId: string;
  shot: UpdateShotInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateShotInput>({
    resolver: zodResolver(updateShotSchema),
    defaultValues: shot,
  });

  async function onSubmit(data: UpdateShotInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateShot(orgSlug, projectId, sceneId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this shot?")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteShot(orgSlug, projectId, sceneId, shot.shotId);
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
      <input type="hidden" {...register("shotId")} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="shot-order">Order</Label>
          <Input
            id="shot-order"
            type="number"
            {...register("shotOrder", { valueAsNumber: true })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="shot-duration">Duration (seconds, optional)</Label>
          <Input
            id="shot-duration"
            type="number"
            step="0.1"
            {...register("durationSeconds", {
              setValueAs: (v) => (v === "" ? undefined : Number(v)),
            })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shot-type">Shot type (optional)</Label>
        <Controller
          control={control}
          name="shotType"
          render={({ field }) => (
            <Select
              value={field.value || NONE}
              onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="shot-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {SHOT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SHOT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shot-description">Description</Label>
        <Textarea
          id="shot-description"
          rows={4}
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-destructive text-sm">
            {errors.description.message}
          </p>
        )}
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
          {isDeleting ? "Deleting..." : "Delete shot"}
        </Button>
      </div>
    </form>
  );
}
