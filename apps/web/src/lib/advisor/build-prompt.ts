import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { AdvisorRole } from "@/lib/validations/advisor";

const ROLE_FRAMING: Record<AdvisorRole, string> = {
  director:
    "You are an experienced film director. Review this project and suggest improvements to story, pacing, and performance.",
  cinematographer:
    "You are an experienced cinematographer. Review this project's shots and suggest improvements to composition, coverage, and visual style.",
  producer:
    "You are an experienced producer. Review this project and suggest improvements to scope, schedule, and resourcing.",
};

// Builds the real context an advisor request sends to the LLM — pulled
// from the project's actual Script Studio, Story Bible, and Storyboard
// data, not a placeholder. The LLM call itself always honestly fails in
// this deployment (see services/ai-orchestrator/app/api/suggestions.py),
// but the context it *would* reason over is genuine.
export async function buildAdvisorPrompt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  role: AdvisorRole,
): Promise<string> {
  const [
    { data: project },
    { data: scripts },
    { data: characters },
    { data: scenes },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("name, description")
      .eq("id", projectId)
      .single(),
    supabase
      .from("scripts")
      .select("title, content")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("characters")
      .select("name, description")
      .eq("project_id", projectId),
    supabase
      .from("scenes")
      .select("title, description, scene_order")
      .eq("project_id", projectId)
      .order("scene_order"),
  ]);

  const sections: string[] = [ROLE_FRAMING[role], ""];

  sections.push(`Project: ${project?.name ?? "Untitled"}`);
  if (project?.description) {
    sections.push(project.description);
  }

  if (characters && characters.length > 0) {
    sections.push(
      "",
      "Characters:",
      ...characters.map(
        (c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`,
      ),
    );
  }

  if (scenes && scenes.length > 0) {
    sections.push(
      "",
      "Scenes:",
      ...scenes.map(
        (s) =>
          `- ${s.scene_order}. ${s.title}${s.description ? `: ${s.description}` : ""}`,
      ),
    );
  }

  const script = scripts?.[0];
  if (script) {
    sections.push(
      "",
      `Script (${script.title}):`,
      script.content.slice(0, 8000),
    );
  }

  return sections.join("\n");
}
