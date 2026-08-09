"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  deleteWorkflowTemplate,
  updateWorkflowTemplate,
} from "@/app/admin/templates/actions";
import {
  TEMPLATE_CATEGORIES,
  updateWorkflowTemplateSchema,
  type UpdateWorkflowTemplateInput,
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

export function EditTemplateForm({
  template,
}: {
  template: UpdateWorkflowTemplateInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpdateWorkflowTemplateInput>({
    resolver: zodResolver(updateWorkflowTemplateSchema),
    defaultValues: template,
  });

  async function onSubmit(data: UpdateWorkflowTemplateInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateWorkflowTemplate(data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSaved(true);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this template? Workflows already cloned from it are unaffected.")) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteWorkflowTemplate(template.templateId);
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
      <input type="hidden" {...register("templateId")} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-template-name">Name</Label>
        <Input
          id="edit-template-name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-template-category">Category</Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="edit-template-category" className="w-full">
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
        <Label htmlFor="edit-template-description">Description</Label>
        <Textarea
          id="edit-template-description"
          rows={3}
          {...register("description")}
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
          {isDeleting ? "Deleting..." : "Delete template"}
        </Button>
      </div>
    </form>
  );
}
