"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createVoiceLine } from "@/app/dashboard/[orgSlug]/projects/[projectId]/voice/actions";
import {
  createVoiceLineSchema,
  type CreateVoiceLineInput,
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

export type AvailableShot = {
  id: string;
  sceneTitle: string;
  shotOrder: number;
  description: string;
};

export function NewVoiceLineForm({
  orgSlug,
  projectId,
  characters,
  availableShots,
}: {
  orgSlug: string;
  projectId: string;
  characters: { id: string; name: string }[];
  availableShots: AvailableShot[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateVoiceLineInput>({
    resolver: zodResolver(createVoiceLineSchema),
    defaultValues: {
      projectId,
      lineOrder: 0,
      characterId: "",
      shotId: "",
      text: "",
    },
  });

  async function onSubmit(data: CreateVoiceLineInput) {
    setServerError(null);
    const result = await createVoiceLine(orgSlug, data);
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
        <Label htmlFor="voice-line-text">Dialogue</Label>
        <Textarea
          id="voice-line-text"
          rows={3}
          aria-invalid={!!errors.text}
          {...register("text")}
        />
        {errors.text && (
          <p className="text-destructive text-sm">{errors.text.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="voice-line-order">Order</Label>
          <Input
            id="voice-line-order"
            type="number"
            {...register("lineOrder", { valueAsNumber: true })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="voice-line-character">Character (optional)</Label>
          <Controller
            control={control}
            name="characterId"
            render={({ field }) => (
              <Select
                value={field.value || NONE}
                onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
              >
                <SelectTrigger id="voice-line-character" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="voice-line-shot">Shot (optional)</Label>
        <Controller
          control={control}
          name="shotId"
          render={({ field }) => (
            <Select
              value={field.value || NONE}
              onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="voice-line-shot" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {availableShots.map((shot) => (
                  <SelectItem key={shot.id} value={shot.id}>
                    {shot.sceneTitle} — shot {shot.shotOrder}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create voice line"}
      </Button>
    </form>
  );
}
