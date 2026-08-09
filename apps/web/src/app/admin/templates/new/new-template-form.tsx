"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createWorkflowTemplate } from "@/app/admin/templates/actions";
import {
  createWorkflowTemplateSchema,
  TEMPLATE_CATEGORIES,
  type CreateWorkflowTemplateInput,
} from "@/lib/validations/workflow-templates";
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

const CATEGORY_LABEL: Record<string, string> = {
  movie: "Movie",
  trailer: "Trailer",
  commercial: "Commercial",
  music_video: "Music Video",
  animation: "Animation",
};

export function NewTemplateForm() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkflowTemplateInput>({
    resolver: zodResolver(createWorkflowTemplateSchema),
    defaultValues: { slug: "", name: "", description: "", category: "movie" },
  });

  async function onSubmit(data: CreateWorkflowTemplateInput) {
    setServerError(null);
    const result = await createWorkflowTemplate(data);
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-name">Name</Label>
        <Input
          id="template-name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-slug">Slug</Label>
        <Input
          id="template-slug"
          placeholder="feature-length-drama"
          aria-invalid={!!errors.slug}
          {...register("slug")}
        />
        {errors.slug && (
          <p className="text-destructive text-sm">{errors.slug.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-category">Category</Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="template-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {CATEGORY_LABEL[category] ?? category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-description">Description</Label>
        <Textarea
          id="template-description"
          rows={3}
          {...register("description")}
        />
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create template"}
      </Button>
    </form>
  );
}
