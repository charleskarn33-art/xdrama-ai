import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Every authenticated page/layout needs this. proxy.ts already redirects
 * unauthenticated requests away from /dashboard, but re-checking here is
 * defense in depth (and required for TypeScript to narrow `user` to
 * non-null) — see docs/00-technical-audit-and-roadmap.md, Section 3.
 */
export async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

/**
 * The model registry (Module 6) is the first platform-level (non-org-
 * scoped) resource — gates access the same way requireOrgMembership does
 * for projects, but on profiles.is_platform_admin instead of org
 * membership. 404s rather than redirecting, matching requireOrgMembership:
 * a non-admin hitting /admin shouldn't learn the route exists.
 */
export async function requirePlatformAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
}> {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    notFound();
  }

  return { supabase, user };
}
