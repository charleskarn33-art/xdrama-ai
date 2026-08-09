import type { Metadata } from "next";

import { requireUser } from "@/lib/supabase/session";
import type { Suggestion } from "./actions";
import { AdvisorRoleCard } from "./advisor-role-card";

export const metadata: Metadata = { title: "AI Advisor" };

const ROLE_COPY = {
  director: {
    title: "Director",
    description: "Story, pacing, and performance suggestions.",
  },
  cinematographer: {
    title: "Cinematographer",
    description: "Shot composition, coverage, and visual style suggestions.",
  },
  producer: {
    title: "Producer",
    description: "Scope, schedule, and resourcing suggestions.",
  },
} as const;

export default async function AdvisorPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const { supabase } = await requireUser();

  const { data: suggestions } = await supabase
    .from("ai_suggestions")
    .select("id, role, status, result, error_message, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const byRole = (role: keyof typeof ROLE_COPY): Suggestion[] =>
    (suggestions ?? []).filter((s) => s.role === role);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Request advice from an AI advisor grounded in this project&apos;s real
        script, story bible, and scenes. Routes through the same AI Model
        Manager and Router as every other generation feature — with no LLM model
        installed yet, requests honestly report that rather than fabricating a
        response.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(ROLE_COPY) as (keyof typeof ROLE_COPY)[]).map((role) => (
          <AdvisorRoleCard
            key={role}
            orgSlug={orgSlug}
            projectId={projectId}
            role={role}
            title={ROLE_COPY[role].title}
            description={ROLE_COPY[role].description}
            initialSuggestions={byRole(role)}
          />
        ))}
      </div>
    </div>
  );
}
