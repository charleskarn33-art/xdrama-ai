"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createOrganizationSchema,
  type CreateOrganizationInput,
} from "@/lib/validations/auth";

export type CreateOrganizationResult = { error: string } | { error: null };

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<CreateOrganizationResult> {
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "That slug is already taken." : error.message,
    };
  }

  revalidatePath("/dashboard");
  return { error: null };
}
