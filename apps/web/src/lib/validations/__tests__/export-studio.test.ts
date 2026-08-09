import { describe, expect, it } from "vitest";

import { createExportJobSchema } from "@/lib/validations/export-studio";

const projectId = "11111111-1111-4111-8111-111111111111";
const timelineId = "22222222-2222-4222-8222-222222222222";
const presetId = "33333333-3333-4333-8333-333333333333";

describe("createExportJobSchema", () => {
  it("accepts a minimal payload with no preset", () => {
    expect(
      createExportJobSchema.safeParse({ projectId, timelineId }).success,
    ).toBe(true);
  });

  it("accepts a payload with a preset", () => {
    expect(
      createExportJobSchema.safeParse({ projectId, timelineId, presetId })
        .success,
    ).toBe(true);
  });

  it("rejects a missing timelineId", () => {
    expect(createExportJobSchema.safeParse({ projectId }).success).toBe(false);
  });
});
