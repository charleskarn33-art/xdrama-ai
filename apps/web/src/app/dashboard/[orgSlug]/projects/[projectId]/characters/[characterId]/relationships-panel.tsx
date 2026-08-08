"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createRelationship,
  deleteRelationship,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/characters/actions";
import {
  createRelationshipSchema,
  type CreateRelationshipInput,
} from "@/lib/validations/story-bible";
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

export type RelationshipRow = {
  id: string;
  otherCharacterName: string;
  relationshipType: string;
  description: string | null;
};

export function RelationshipsPanel({
  orgSlug,
  projectId,
  characterId,
  relationships,
  otherCharacters,
}: {
  orgSlug: string;
  projectId: string;
  characterId: string;
  relationships: RelationshipRow[];
  otherCharacters: { id: string; name: string }[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateRelationshipInput>({
    resolver: zodResolver(createRelationshipSchema),
    defaultValues: { characterId, relatedCharacterId: otherCharacters[0]?.id ?? "" },
  });

  async function onSubmit(data: CreateRelationshipInput) {
    setServerError(null);
    const result = await createRelationship(orgSlug, projectId, data);
    if (result.error) {
      setServerError(result.error);
    } else {
      reset({
        characterId,
        relatedCharacterId: otherCharacters[0]?.id ?? "",
        relationshipType: "",
        description: "",
      });
    }
  }

  async function onDelete(relationshipId: string) {
    await deleteRelationship(orgSlug, projectId, characterId, relationshipId);
  }

  return (
    <div className="flex flex-col gap-4">
      {relationships.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {relationships.map((rel) => (
            <li
              key={rel.id}
              className="bg-secondary flex items-center justify-between rounded-md px-3 py-2"
            >
              <div>
                <span className="font-medium">{rel.otherCharacterName}</span>
                <span className="text-muted-foreground"> — {rel.relationshipType}</span>
                {rel.description && (
                  <p className="text-muted-foreground text-sm">{rel.description}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(rel.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No relationships yet.</p>
      )}

      {otherCharacters.length > 0 ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3 border-t pt-4"
          noValidate
        >
          <input type="hidden" {...register("characterId")} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="rel-character">Character</Label>
            <Controller
              control={control}
              name="relatedCharacterId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rel-character" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {otherCharacters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rel-type">Relationship</Label>
            <Input
              id="rel-type"
              placeholder="rival, sibling, mentor..."
              aria-invalid={!!errors.relationshipType}
              {...register("relationshipType")}
            />
            {errors.relationshipType && (
              <p className="text-destructive text-sm">{errors.relationshipType.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rel-description">Notes</Label>
            <Input id="rel-description" {...register("description")} />
          </div>

          {serverError && <p className="text-destructive text-sm">{serverError}</p>}

          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? "Adding..." : "Add relationship"}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          Add another character first to create a relationship.
        </p>
      )}
    </div>
  );
}
