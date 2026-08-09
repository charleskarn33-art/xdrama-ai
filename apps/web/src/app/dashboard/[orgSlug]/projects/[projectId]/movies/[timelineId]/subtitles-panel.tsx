"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  addSubtitle,
  deleteSubtitle,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/movies/actions";
import {
  createSubtitleSchema,
  type CreateSubtitleInput,
} from "@/lib/validations/audio-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "none";

export type SubtitleRow = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export function SubtitlesPanel({
  orgSlug,
  projectId,
  timelineId,
  subtitles,
  voiceLines,
}: {
  orgSlug: string;
  projectId: string;
  timelineId: string;
  subtitles: SubtitleRow[];
  voiceLines: { id: string; text: string }[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubtitleInput>({
    resolver: zodResolver(createSubtitleSchema),
    defaultValues: {
      timelineId,
      voiceLineId: "",
      startSeconds: 0,
      endSeconds: 1,
      text: "",
    },
  });

  async function onSubmit(data: CreateSubtitleInput) {
    setServerError(null);
    const result = await addSubtitle(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      reset({
        timelineId,
        voiceLineId: "",
        startSeconds: 0,
        endSeconds: 1,
        text: "",
      });
    }
  }

  async function onRemove(subtitleId: string) {
    setRemovingId(subtitleId);
    const result = await deleteSubtitle(
      orgSlug,
      projectId,
      timelineId,
      subtitleId,
    );
    if (result.error) {
      setServerError(result.error);
    }
    setRemovingId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {subtitles.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {subtitles.map((sub) => (
            <li
              key={sub.id}
              className="bg-secondary/40 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm"
            >
              <div>
                <span className="text-muted-foreground font-mono text-xs">
                  {sub.startSeconds.toFixed(1)}s–{sub.endSeconds.toFixed(1)}s
                </span>
                <p>{sub.text}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removingId === sub.id}
                onClick={() => onRemove(sub.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No subtitles yet.</p>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3 border-t pt-4"
        noValidate
      >
        <input type="hidden" {...register("timelineId")} />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="subtitle-start">Start (seconds)</Label>
            <Input
              id="subtitle-start"
              type="number"
              step="0.1"
              {...register("startSeconds", { valueAsNumber: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subtitle-end">End (seconds)</Label>
            <Input
              id="subtitle-end"
              type="number"
              step="0.1"
              {...register("endSeconds", { valueAsNumber: true })}
            />
            {errors.endSeconds && (
              <p className="text-destructive text-sm">
                {errors.endSeconds.message}
              </p>
            )}
          </div>
        </div>

        {voiceLines.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="subtitle-voice-line">
              Copy from voice line (optional)
            </Label>
            <Controller
              control={control}
              name="voiceLineId"
              render={({ field }) => (
                <Select
                  value={field.value || NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                >
                  <SelectTrigger id="subtitle-voice-line" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {voiceLines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.text.slice(0, 40)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="subtitle-text">Caption text</Label>
          <Input
            id="subtitle-text"
            aria-invalid={!!errors.text}
            {...register("text")}
          />
          {errors.text && (
            <p className="text-destructive text-sm">{errors.text.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-destructive text-sm">{serverError}</p>
        )}

        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Adding..." : "Add subtitle"}
        </Button>
      </form>
    </div>
  );
}
