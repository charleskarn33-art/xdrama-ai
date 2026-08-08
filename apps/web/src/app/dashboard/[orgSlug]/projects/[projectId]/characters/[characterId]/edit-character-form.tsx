"use client";

import * as React from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteCharacter,
  updateCharacter,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/characters/actions";
import {
  updateCharacterSchema,
  type UpdateCharacterInput,
} from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EditCharacterForm({
  orgSlug,
  projectId,
  character,
}: {
  orgSlug: string;
  projectId: string;
  character: UpdateCharacterInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCharacterInput>({
    resolver: zodResolver(updateCharacterSchema),
    defaultValues: character,
  });

  async function onSubmit(data: UpdateCharacterInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateCharacter(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this character? This also removes their relationships.")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteCharacter(orgSlug, projectId, character.characterId);
    if (result.error) {
      setServerError(result.error);
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("characterId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="character-name">Name</Label>
        <Input id="character-name" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="character-description">Description</Label>
        <Textarea id="character-description" rows={2} {...register("description")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="character-appearance">Appearance</Label>
        <Textarea id="character-appearance" rows={3} {...register("appearance")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="character-personality">Personality</Label>
        <Textarea id="character-personality" rows={3} {...register("personality")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="character-voice">Voice</Label>
        <Textarea id="character-voice" rows={2} {...register("voiceDescription")} />
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
          {isDeleting ? "Deleting..." : "Delete character"}
        </Button>
      </div>
    </form>
  );
}
