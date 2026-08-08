"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createScript } from "@/app/dashboard/[orgSlug]/projects/[projectId]/scripts/actions";
import { createScriptSchema, type CreateScriptInput } from "@/lib/validations/scripts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewScriptForm({
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
  } = useForm<CreateScriptInput>({
    resolver: zodResolver(createScriptSchema),
    defaultValues: { projectId, title: "", content: "" },
  });

  async function onSubmit(data: CreateScriptInput) {
    setServerError(null);
    const result = await createScript(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("projectId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="script-title">Title</Label>
        <Input id="script-title" aria-invalid={!!errors.title} {...register("title")} />
        {errors.title && (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="script-content">Content</Label>
        <Textarea
          id="script-content"
          rows={16}
          className="font-mono text-sm"
          placeholder="FADE IN:"
          {...register("content")}
        />
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create script"}
      </Button>
    </form>
  );
}
