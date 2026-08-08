import { redirect } from "next/navigation";
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
