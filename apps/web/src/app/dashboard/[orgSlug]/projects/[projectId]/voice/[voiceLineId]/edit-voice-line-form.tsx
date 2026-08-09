"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteVoiceLine,
  updateVoiceLine,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/voice/actions";
import {
  updateVoiceLineSchema,
  type UpdateVoiceLineInput,
} from "@/lib/validations/audio-studio";
import type { AvailableShot } from "../new/new-voice-line-form";
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

export function EditVoiceLineForm({
  orgSlug,
  projectId,
  voiceLine,
  characters,
  availableShots,
}: {
  orgSlug: string;
  projectId: string;
  voiceLine: UpdateVoiceLineInput;
  characters: { id: string; name: string }[];
  availableShots: AvailableShot[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateVoiceLineInput>({
    resolver: zodResolver(updateVoiceLineSchema),
    defaultValues: voiceLine,
  });

  async function onSubmit(data: UpdateVoiceLineInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateVoiceLine(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this voice line?")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteVoiceLine(
      orgSlug,
      projectId,
      voiceLine.voiceLineId,
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
      <input type="hidden" {...register("voiceLineId")} />

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
          {isDeleting ? "Deleting..." : "Delete voice line"}
        </Button>
      </div>
    </form>
  );
}
