"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createCharacter } from "@/app/dashboard/[orgSlug]/projects/[projectId]/characters/actions";
import {
  createCharacterSchema,
  type CreateCharacterInput,
} from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewCharacterForm({
  orgSlug,
  projectId,
}: {
  orgSlug: string;
  projectId: string;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCharacterInput>({
    resolver: zodResolver(createCharacterSchema),
    defaultValues: { projectId, name: "" },
  });

  async function onSubmit(data: CreateCharacterInput) {
    setServerError(null);
    const result = await createCharacter(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("projectId")} />

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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create character"}
      </Button>
    </form>
  );
}
