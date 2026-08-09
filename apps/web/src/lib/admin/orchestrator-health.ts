import "server-only";

import { getServerEnv } from "@/env";

export type OrchestratorHealth =
  | { reachable: true; status: string; service: string }
  | { reachable: false; error: string };

/**
 * Unlike callOrchestrator(), this hits /health directly with no auth
 * header — the orchestrator's health endpoint takes none (see
 * services/ai-orchestrator/app/api/health.py) — and never throws: an
 * admin dashboard reporting "orchestrator unreachable" is a real,
 * honest status, not an error that should crash the page.
 */
export async function getOrchestratorHealth(): Promise<OrchestratorHealth> {
  const { AI_ORCHESTRATOR_URL } = getServerEnv();

  try {
    const response = await fetch(`${AI_ORCHESTRATOR_URL}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!response.ok) {
      return { reachable: false, error: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { status: string; service: string };
    return { reachable: true, status: body.status, service: body.service };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
