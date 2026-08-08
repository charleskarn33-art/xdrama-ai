"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createOrganization } from "@/app/dashboard/actions";
import {
  createOrganizationSchema,
  type CreateOrganizationInput,
} from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateOrganizationForm() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
  });

  async function onSubmit(data: CreateOrganizationInput) {
    setServerError(null);
    const result = await createOrganization(data);
    if (result.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          placeholder="Acme Pictures"
          aria-invalid={!!errors.name}
          {...register("name", {
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              if (!slugTouched) {
                setValue("slug", slugify(event.target.value), {
                  shouldValidate: true,
                });
              }
            },
          })}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-slug">URL slug</Label>
        <Input
          id="org-slug"
          placeholder="acme-pictures"
          aria-invalid={!!errors.slug}
          {...register("slug", {
            onChange: () => setSlugTouched(true),
          })}
        />
        {errors.slug && (
          <p className="text-destructive text-sm">{errors.slug.message}</p>
        )}
      </div>

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create organization"}
      </Button>
    </form>
  );
}
