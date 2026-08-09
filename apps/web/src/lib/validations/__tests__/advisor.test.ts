import { describe, expect, it } from "vitest";

import { requestSuggestionsSchema } from "@/lib/validations/advisor";

const projectId = "11111111-1111-4111-8111-111111111111";

describe("requestSuggestionsSchema", () => {
  it("accepts each advisor role", () => {
    for (const role of ["director", "cinematographer", "producer"] as const) {
      expect(
        requestSuggestionsSchema.safeParse({ projectId, role }).success,
      ).toBe(true);
    }
  });

  it("rejects an unknown role", () => {
    expect(
      requestSuggestionsSchema.safeParse({ projectId, role: "editor" }).success,
    ).toBe(false);
  });
});
