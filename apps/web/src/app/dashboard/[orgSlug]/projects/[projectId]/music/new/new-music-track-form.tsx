"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createMusicTrack } from "@/app/dashboard/[orgSlug]/projects/[projectId]/music/actions";
import {
  createMusicTrackSchema,
  type CreateMusicTrackInput,
} from "@/lib/validations/audio-studio";
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

export function NewMusicTrackForm({
  orgSlug,
  projectId,
  scenes,
}: {
  orgSlug: string;
  projectId: string;
  scenes: { id: string; title: string }[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateMusicTrackInput>({
    resolver: zodResolver(createMusicTrackSchema),
    defaultValues: { projectId, name: "", sceneId: "" },
  });

  async function onSubmit(data: CreateMusicTrackInput) {
    setServerError(null);
    const result = await createMusicTrack(orgSlug, data);
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
        <Label htmlFor="track-name">Name</Label>
        <Input
          id="track-name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="track-description">Description / prompt</Label>
        <Textarea
          id="track-description"
          rows={3}
          {...register("description")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="track-scene">Scene (optional)</Label>
        <Controller
          control={control}
          name="sceneId"
          render={({ field }) => (
            <Select
              value={field.value || NONE}
              onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="track-scene" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {scenes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create track"}
      </Button>
    </form>
  );
}
