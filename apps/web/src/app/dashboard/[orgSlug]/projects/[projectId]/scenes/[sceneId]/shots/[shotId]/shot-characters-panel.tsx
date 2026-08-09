"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  addShotCharacter,
  removeShotCharacter,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/scenes/actions";
import {
  addShotCharacterSchema,
  type AddShotCharacterInput,
} from "@/lib/validations/storyboard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ShotCharactersPanel({
  orgSlug,
  projectId,
  sceneId,
  shotId,
  taggedCharacters,
  availableCharacters,
}: {
  orgSlug: string;
  projectId: string;
  sceneId: string;
  shotId: string;
  taggedCharacters: { id: string; name: string }[];
  availableCharacters: { id: string; name: string }[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const {
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<AddShotCharacterInput>({
    resolver: zodResolver(addShotCharacterSchema),
    defaultValues: { shotId, characterId: availableCharacters[0]?.id ?? "" },
  });

  async function onSubmit(data: AddShotCharacterInput) {
    setServerError(null);
    const result = await addShotCharacter(orgSlug, projectId, sceneId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      reset({ shotId, characterId: availableCharacters[0]?.id ?? "" });
    }
  }

  async function onRemove(characterId: string) {
    setRemovingId(characterId);
    await removeShotCharacter(orgSlug, projectId, sceneId, shotId, characterId);
    setRemovingId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {taggedCharacters.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {taggedCharacters.map((c) => (
            <li
              key={c.id}
              className="bg-secondary flex items-center justify-between rounded-md px-3 py-2"
            >
              <span className="font-medium">{c.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removingId === c.id}
                onClick={() => onRemove(c.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No characters tagged yet.
        </p>
      )}

      {availableCharacters.length > 0 ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-end gap-2 border-t pt-4"
          noValidate
        >
          <div className="flex-1">
            <Controller
              control={control}
              name="characterId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCharacters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Tag character"}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          Every character in this project is already tagged.
        </p>
      )}

      {serverError && <p className="text-destructive text-xs">{serverError}</p>}
    </div>
  );
}
