"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createProp } from "@/app/dashboard/[orgSlug]/projects/[projectId]/props/actions";
import {
  createPropSchema,
  type CreatePropInput,
} from "@/lib/validations/story-bible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewPropForm({
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
  } = useForm<CreatePropInput>({
    resolver: zodResolver(createPropSchema),
    defaultValues: { projectId, name: "" },
  });

  async function onSubmit(data: CreatePropInput) {
    setServerError(null);
    const result = await createProp(orgSlug, data);
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
        <Label htmlFor="prop-name">Name</Label>
        <Input
          id="prop-name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-description">Description</Label>
        <Textarea id="prop-description" rows={3} {...register("description")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-appearance">Appearance</Label>
        <Textarea id="prop-appearance" rows={3} {...register("appearance")} />
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create prop"}
      </Button>
    </form>
  );
}
