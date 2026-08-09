"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteMusicTrack,
  updateMusicTrack,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/music/actions";
import {
  updateMusicTrackSchema,
  type UpdateMusicTrackInput,
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

export function EditMusicTrackForm({
  orgSlug,
  projectId,
  track,
  scenes,
}: {
  orgSlug: string;
  projectId: string;
  track: UpdateMusicTrackInput;
  scenes: { id: string; title: string }[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateMusicTrackInput>({
    resolver: zodResolver(updateMusicTrackSchema),
    defaultValues: track,
  });

  async function onSubmit(data: UpdateMusicTrackInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateMusicTrack(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this music track?")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteMusicTrack(
      orgSlug,
      projectId,
      track.musicTrackId,
    );
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
      <input type="hidden" {...register("musicTrackId")} />

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
          {isDeleting ? "Deleting..." : "Delete track"}
        </Button>
      </div>
    </form>
  );
}
