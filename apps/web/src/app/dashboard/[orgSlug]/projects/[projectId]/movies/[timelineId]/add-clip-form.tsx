"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { addClip } from "@/app/dashboard/[orgSlug]/projects/[projectId]/movies/actions";
import {
  addClipSchema,
  TRANSITION_TYPES,
  type AddClipInput,
} from "@/lib/validations/movie-composer";
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

const TRANSITION_LABEL: Record<(typeof TRANSITION_TYPES)[number], string> = {
  cut: "Cut",
  fade: "Fade",
  dissolve: "Dissolve",
  wipe: "Wipe",
};

export type AvailableShot = {
  id: string;
  sceneTitle: string;
  shotOrder: number;
  description: string;
};

export function AddClipForm({
  orgSlug,
  projectId,
  timelineId,
  nextClipOrder,
  availableShots,
}: {
  orgSlug: string;
  projectId: string;
  timelineId: string;
  nextClipOrder: number;
  availableShots: AvailableShot[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<AddClipInput>({
    resolver: zodResolver(addClipSchema),
    defaultValues: {
      timelineId,
      shotId: availableShots[0]?.id ?? "",
      clipOrder: nextClipOrder,
      transitionIn: "cut",
    },
  });

  async function onSubmit(data: AddClipInput) {
    setServerError(null);
    const result = await addClip(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      reset({
        timelineId,
        shotId: availableShots[0]?.id ?? "",
        clipOrder: nextClipOrder + 1,
        transitionIn: "cut",
      });
    }
  }

  if (availableShots.length === 0) {
    return (
      <p className="text-muted-foreground border-t pt-4 text-sm">
        No shots exist in this project yet — add some in Scenes first.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 border-t pt-4"
      noValidate
    >
      <input type="hidden" {...register("timelineId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="clip-shot">Shot</Label>
        <Controller
          control={control}
          name="shotId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="clip-shot" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableShots.map((shot) => (
                  <SelectItem key={shot.id} value={shot.id}>
                    {shot.sceneTitle} — shot {shot.shotOrder}:{" "}
                    {shot.description.slice(0, 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="clip-order">Order</Label>
          <Input
            id="clip-order"
            type="number"
            {...register("clipOrder", { valueAsNumber: true })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="clip-transition">Transition in</Label>
          <Controller
            control={control}
            name="transitionIn"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="clip-transition" className="w-full">
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
        </div>
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Adding..." : "Add clip"}
      </Button>
    </form>
  );
}
