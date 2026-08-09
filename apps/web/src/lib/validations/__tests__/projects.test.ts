import { describe, expect, it } from "vitest";

import {
  createProjectSchema,
  deleteProjectSchema,
  updateProjectSchema,
} from "@/lib/validations/projects";

const validOrgId = "11111111-1111-4111-8111-111111111111";
const validProjectId = "22222222-2222-4222-8222-222222222222";

describe("createProjectSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createProjectSchema.safeParse({
        orgId: validOrgId,
        name: "Pilot Episode",
        description: "First script",
      }).success,
    ).toBe(true);
  });

  it("accepts an empty description", () => {
    expect(
      createProjectSchema.safeParse({
        orgId: validOrgId,
        name: "Pilot Episode",
        description: "",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      createProjectSchema.safeParse({ orgId: validOrgId, name: "  " }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid orgId", () => {
    expect(
      createProjectSchema.safeParse({ orgId: "not-a-uuid", name: "Pilot" })
        .success,
    ).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      updateProjectSchema.safeParse({
        projectId: validProjectId,
        name: "Renamed",
        description: "",
        status: "in_progress",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(
      updateProjectSchema.safeParse({
        projectId: validProjectId,
        name: "Renamed",
        status: "cancelled",
      }).success,
    ).toBe(false);
  });
});

describe("deleteProjectSchema", () => {
  it("accepts a valid uuid", () => {
    expect(
      deleteProjectSchema.safeParse({ projectId: validProjectId }).success,
    ).toBe(true);
  });

  it("rejects a missing projectId", () => {
    expect(deleteProjectSchema.safeParse({}).success).toBe(false);
  });
});
