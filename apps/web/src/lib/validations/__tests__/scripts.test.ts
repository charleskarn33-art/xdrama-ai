import { describe, expect, it } from "vitest";

import {
  createScriptSchema,
  deleteScriptSchema,
  updateScriptSchema,
} from "@/lib/validations/scripts";

const projectId = "11111111-1111-4111-8111-111111111111";
const scriptId = "22222222-2222-4222-8222-222222222222";

describe("createScriptSchema", () => {
  it("accepts a title-only payload", () => {
    expect(
      createScriptSchema.safeParse({ projectId, title: "Pilot Draft 1" })
        .success,
    ).toBe(true);
  });

  it("accepts content", () => {
    expect(
      createScriptSchema.safeParse({
        projectId,
        title: "Pilot Draft 1",
        content: "FADE IN: A quiet town.",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(
      createScriptSchema.safeParse({ projectId, title: "  " }).success,
    ).toBe(false);
  });
});

describe("updateScriptSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      updateScriptSchema.safeParse({
        scriptId,
        title: "Pilot Draft 1",
        content: "",
        status: "final",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(
      updateScriptSchema.safeParse({
        scriptId,
        title: "Pilot Draft 1",
        status: "published",
      }).success,
    ).toBe(false);
  });
});

describe("deleteScriptSchema", () => {
  it("accepts a valid uuid", () => {
    expect(deleteScriptSchema.safeParse({ scriptId }).success).toBe(true);
  });

  it("rejects a missing scriptId", () => {
    expect(deleteScriptSchema.safeParse({}).success).toBe(false);
  });
});
