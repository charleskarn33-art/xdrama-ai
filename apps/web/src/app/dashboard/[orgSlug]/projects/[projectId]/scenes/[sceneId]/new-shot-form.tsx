"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createShot } from "@/app/dashboard/[orgSlug]/projects/[projectId]/scenes/actions";
import {
  createShotSchema,
  SHOT_TYPES,
  type CreateShotInput,
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

export function NewShotForm({
  orgSlug,
  projectId,
  sceneId,
  nextShotOrder,
}: {
  orgSlug: string;
  projectId: string;
  sceneId: string;
  nextShotOrder: number;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateShotInput>({
    resolver: zodResolver(createShotSchema),
    defaultValues: {
      sceneId,
      shotOrder: nextShotOrder,
      shotType: "",
      description: "",
    },
  });

  async function onSubmit(data: CreateShotInput) {
    setServerError(null);
    const result = await createShot(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      reset({
        sceneId,
        shotOrder: nextShotOrder + 1,
        shotType: "",
        description: "",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 border-t pt-4"
      noValidate
    >
      <input type="hidden" {...register("sceneId")} />

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
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shot-description">Description</Label>
        <Textarea
          id="shot-description"
          rows={2}
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

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Adding..." : "Add shot"}
      </Button>
    </form>
  );
}
