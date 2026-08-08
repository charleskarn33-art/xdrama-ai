import { notFound } from "next/navigation";

import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolves an org slug to its id/role for the current user, or 404s.
 * RLS already scopes organizations to the caller's memberships — this
 * just turns "not found" into a 404 instead of a null a caller could
 * forget to check.
 */
export async function requireOrgMembership(
  supabase: SupabaseClient,
  userId: string,
  orgSlug: string,
) {
  const { data } = await supabase
    .from("organization_members")
    .select("role, organizations!inner(id, name, slug)")
    .eq("user_id", userId)
    .eq("organizations.slug", orgSlug)
    .single();

  if (!data || !data.organizations) {
    notFound();
  }

  return { org: data.organizations, role: data.role };
}
