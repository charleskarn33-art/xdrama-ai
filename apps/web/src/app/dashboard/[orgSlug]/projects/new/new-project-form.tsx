"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createProject } from "@/app/dashboard/[orgSlug]/projects/actions";
import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/validations/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewProjectForm({
  orgId,
  orgSlug,
}: {
  orgId: string;
  orgSlug: string;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { orgId, name: "", description: "" },
  });

  async function onSubmit(data: CreateProjectInput) {
    setServerError(null);
    const result = await createProject(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register("orgId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="project-name">Name</Label>
        <Input
          id="project-name"
          placeholder="Pilot Episode"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          placeholder="What's this project about?"
          rows={4}
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-destructive text-sm">{errors.description.message}</p>
        )}
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create project"}
      </Button>
    </form>
  );
}
