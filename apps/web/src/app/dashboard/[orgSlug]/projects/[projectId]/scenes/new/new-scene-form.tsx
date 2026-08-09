"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createScene } from "@/app/dashboard/[orgSlug]/projects/[projectId]/scenes/actions";
import {
  createSceneSchema,
  type CreateSceneInput,
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

export function NewSceneForm({
  orgSlug,
  projectId,
  scripts,
  locations,
}: {
  orgSlug: string;
  projectId: string;
  scripts: { id: string; title: string }[];
  locations: { id: string; name: string }[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateSceneInput>({
    resolver: zodResolver(createSceneSchema),
    defaultValues: {
      projectId,
      title: "",
      sceneOrder: 0,
      scriptId: "",
      locationId: "",
    },
  });

  async function onSubmit(data: CreateSceneInput) {
    setServerError(null);
    const result = await createScene(orgSlug, data);
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create scene"}
      </Button>
    </form>
  );
}
