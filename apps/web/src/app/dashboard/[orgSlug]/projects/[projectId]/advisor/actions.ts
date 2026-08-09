"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { callOrchestrator, OrchestratorError } from "@/lib/orchestrator";
import { buildAdvisorPrompt } from "@/lib/advisor/build-prompt";
import {
  requestSuggestionsSchema,
  type RequestSuggestionsInput,
} from "@/lib/validations/advisor";

export type Suggestion = {
  id: string;
  role: string;
  status: string;
  result: unknown;
  error_message: string | null;
  created_at: string;
};

export type RequestSuggestionsResult =
  { error: string } | { error: null; suggestion: Suggestion };

const SUGGESTION_SELECT = "id, role, status, result, error_message, created_at";

export async function requestSuggestions(
  orgSlug: string,
  input: RequestSuggestionsInput,
): Promise<RequestSuggestionsResult> {
  const parsed = requestSuggestionsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const prompt = await buildAdvisorPrompt(
    supabase,
    parsed.data.projectId,
    parsed.data.role,
  );

  const { data: suggestion, error } = await supabase
    .from("ai_suggestions")
    .insert({
      project_id: parsed.data.projectId,
      role: parsed.data.role,
      prompt,
    })
    .select(SUGGESTION_SELECT)
    .single();

  if (error || !suggestion) {
    return { error: error?.message ?? "Could not create suggestion request" };
  }

  revalidatePath(
    `/dashboard/${orgSlug}/projects/${parsed.data.projectId}/advisor`,
  );

  try {
    await callOrchestrator<{ ok: boolean; status: string; message: string }>(
      `/api/v1/suggestions/${suggestion.id}/generate`,
      { method: "POST" },
    );
  } catch (err) {
    return {
      error:
        err instanceof OrchestratorError
          ? err.message
          : "Suggestion request failed",
    };
  }

  // Generation can synchronously fail the row server-side (e.g. "no
  // eligible model installed") — re-fetch so the caller gets the
  // authoritative row instead of the pre-generation 'pending' snapshot.
  const { data: refreshed } = await supabase
    .from("ai_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("id", suggestion.id)
    .single();

  return { error: null, suggestion: refreshed ?? suggestion };
}
