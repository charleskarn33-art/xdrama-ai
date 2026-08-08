import { afterEach, describe, expect, it, vi } from "vitest";

import { callOrchestrator, OrchestratorError } from "@/lib/orchestrator";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/env", () => ({
  getServerEnv: vi.fn(() => ({ AI_ORCHESTRATOR_URL: "http://orchestrator.internal" })),
}));

import { createClient } from "@/lib/supabase/server";

const createClientMock = vi.mocked(createClient);

function mockSession(session: { access_token: string } | null) {
  createClientMock.mockResolvedValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe("callOrchestrator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws OrchestratorError when there is no active session", async () => {
    mockSession(null);

    await expect(callOrchestrator("/api/v1/models")).rejects.toBeInstanceOf(
      OrchestratorError,
    );
  });

  it("forwards the access token as a bearer header", async () => {
    mockSession({ access_token: "test-token" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await callOrchestrator("/api/v1/models/123/install", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://orchestrator.internal/api/v1/models/123/install",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("throws OrchestratorError with the response body on a non-ok response", async () => {
    mockSession({ access_token: "test-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "Platform admin access required",
      }),
    );

    await expect(callOrchestrator("/api/v1/models/123/install")).rejects.toThrow(
      /403/,
    );
  });

  it("returns the parsed JSON response on success", async () => {
    mockSession({ access_token: "test-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, message: "Installed." }),
      }),
    );

    const result = await callOrchestrator<{ ok: boolean; message: string }>(
      "/api/v1/models/123/install",
    );

    expect(result).toEqual({ ok: true, message: "Installed." });
  });
});
