"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteClip,
  updateClip,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/movies/actions";
import {
  TRANSITION_TYPES,
  updateClipSchema,
  type UpdateClipInput,
} from "@/lib/validations/movie-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TRANSITION_LABEL: Record<(typeof TRANSITION_TYPES)[number], string> = {
  cut: "Cut",
  fade: "Fade",
  dissolve: "Dissolve",
  wipe: "Wipe",
};

export type ClipRowData = {
  clipId: string;
  clipOrder: number;
  transitionIn: (typeof TRANSITION_TYPES)[number];
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  sceneTitle: string;
  shotOrder: number;
  shotDescription: string;
  hasSourceRender: boolean;
};

export function ClipRow({
  orgSlug,
  projectId,
  timelineId,
  clip,
}: {
  orgSlug: string;
  projectId: string;
  timelineId: string;
  clip: ClipRowData;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting, isDirty },
  } = useForm<UpdateClipInput>({
    resolver: zodResolver(updateClipSchema),
    defaultValues: {
      clipId: clip.clipId,
      clipOrder: clip.clipOrder,
      transitionIn: clip.transitionIn,
      trimStartSeconds: clip.trimStartSeconds,
      trimEndSeconds: clip.trimEndSeconds,
    },
  });

  async function onSubmit(data: UpdateClipInput) {
    setServerError(null);
    const result = await updateClip(orgSlug, projectId, timelineId, data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  async function onRemove() {
    setIsRemoving(true);
    const result = await deleteClip(
      orgSlug,
      projectId,
      timelineId,
      clip.clipId,
    );
    if (result.error) {
      setServerError(result.error);
      setIsRemoving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-secondary/40 flex flex-col gap-2 rounded-md px-3 py-2"
      noValidate
    >
      <input type="hidden" {...register("clipId")} />

      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-sm font-medium">
            {clip.sceneTitle} — shot {clip.shotOrder}
          </span>
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
              clip.hasSourceRender
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {clip.hasSourceRender ? "Rendered" : "Not yet rendered"}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isRemoving}
          onClick={onRemove}
        >
          {isRemoving ? "Removing..." : "Remove"}
        </Button>
      </div>

      <p className="text-muted-foreground line-clamp-1 text-sm">
        {clip.shotDescription}
      </p>

      <div className="grid grid-cols-4 gap-2">
        <Input
          type="number"
          aria-label="Order"
          {...register("clipOrder", { valueAsNumber: true })}
        />
        <Controller
          control={control}
          name="transitionIn"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Transition in">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSITION_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <Input
          type="number"
          step="0.1"
          placeholder="Trim start"
          aria-label="Trim start seconds"
          {...register("trimStartSeconds", {
            setValueAs: (v) => (v === "" ? undefined : Number(v)),
          })}
        />
        <Input
          type="number"
          step="0.1"
          placeholder="Trim end"
          aria-label="Trim end seconds"
          {...register("trimEndSeconds", {
            setValueAs: (v) => (v === "" ? undefined : Number(v)),
          })}
        />
      </div>

      {serverError && <p className="text-destructive text-xs">{serverError}</p>}

      <Button
        type="submit"
        size="sm"
        disabled={!isDirty || isSubmitting}
        className="self-start"
      >
        {isSubmitting ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
