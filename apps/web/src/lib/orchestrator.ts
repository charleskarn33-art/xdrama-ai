import "server-only";

import { getServerEnv } from "@/env";
import { createClient } from "@/lib/supabase/server";

export class OrchestratorError extends Error {}

/**
 * Calls the AI orchestration service, forwarding the current user's
 * Supabase access token so the orchestrator can independently verify it
 * (see services/ai-orchestrator/app/core/auth.py) — this app never asks
 * the orchestrator to trust a request just because it came from here.
 */
export async function callOrchestrator<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new OrchestratorError("No active session");
  }

  const { AI_ORCHESTRATOR_URL } = getServerEnv();
  const response = await fetch(`${AI_ORCHESTRATOR_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new OrchestratorError(
      `Orchestrator request failed (${response.status}): ${body}`,
    );
  }

  return response.json() as Promise<T>;
}
