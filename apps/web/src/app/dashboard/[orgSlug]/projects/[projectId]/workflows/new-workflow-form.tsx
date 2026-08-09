"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createWorkflowFromTemplate } from "@/app/dashboard/[orgSlug]/projects/[projectId]/workflows/actions";
import {
  createWorkflowFromTemplateSchema,
  type CreateWorkflowFromTemplateInput,
} from "@/lib/validations/workflows";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function NewWorkflowForm({
  orgSlug,
  projectId,
  templateId,
  defaultName,
}: {
  orgSlug: string;
  projectId: string;
  templateId: string;
  defaultName: string;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CreateWorkflowFromTemplateInput>({
    resolver: zodResolver(createWorkflowFromTemplateSchema),
    defaultValues: { projectId, templateId, name: defaultName },
  });

  async function onSubmit(data: CreateWorkflowFromTemplateInput) {
    setServerError(null);
    const result = await createWorkflowFromTemplate(orgSlug, data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <input type="hidden" {...register("projectId")} />
      <input type="hidden" {...register("templateId")} />
      <CardContent className="flex flex-col gap-2">
        <Input {...register("name")} aria-label="Workflow name" />
        {serverError && (
          <p className="text-destructive text-xs">{serverError}</p>
        )}
      </CardContent>
      <CardFooter>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Use this template"}
        </Button>
      </CardFooter>
    </form>
  );
}
