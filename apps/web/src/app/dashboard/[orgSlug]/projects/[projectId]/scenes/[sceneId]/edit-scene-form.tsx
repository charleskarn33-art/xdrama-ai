"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteScene,
  updateScene,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/scenes/actions";
import {
  updateSceneSchema,
  type UpdateSceneInput,
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

export function EditSceneForm({
  orgSlug,
  projectId,
  scene,
  scripts,
  locations,
}: {
  orgSlug: string;
  projectId: string;
  scene: UpdateSceneInput;
  scripts: { id: string; title: string }[];
  locations: { id: string; name: string }[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateSceneInput>({
    resolver: zodResolver(updateSceneSchema),
    defaultValues: scene,
  });

  async function onSubmit(data: UpdateSceneInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateScene(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this scene? Its shots will be deleted too.")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteScene(orgSlug, projectId, scene.sceneId);
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
      <input type="hidden" {...register("sceneId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="scene-title">Title</Label>
        <Input
          id="scene-title"
          aria-invalid={!!errors.title}
          {...register("title")}
        />
        {errors.title && (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="scene-order">Order</Label>
        <Input
          id="scene-order"
          type="number"
          {...register("sceneOrder", { valueAsNumber: true })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="scene-description">Description</Label>
        <Textarea
          id="scene-description"
          rows={3}
          {...register("description")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="scene-script">Script (optional)</Label>
        <Controller
          control={control}
          name="scriptId"
          render={({ field }) => (
            <Select
              value={field.value || NONE}
              onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="scene-script" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {scripts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="scene-location">Location (optional)</Label>
        <Controller
          control={control}
          name="locationId"
          render={({ field }) => (
            <Select
              value={field.value || NONE}
              onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="scene-location" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
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
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={isDeleting}
          onClick={onDelete}
        >
          {isDeleting ? "Deleting..." : "Delete scene"}
        </Button>
      </div>
    </form>
  );
}
