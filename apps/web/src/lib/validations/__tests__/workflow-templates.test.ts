import { describe, expect, it } from "vitest";

import {
  createWorkflowTemplateSchema,
  updateWorkflowTemplateGraphSchema,
  updateWorkflowTemplateSchema,
} from "@/lib/validations/workflow-templates";

const templateId = "11111111-1111-4111-8111-111111111111";

const VALID_GRAPH = {
  nodes: [{ id: "a", type: "input", position: { x: 0, y: 0 }, config: {} }],
  edges: [],
};

describe("createWorkflowTemplateSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createWorkflowTemplateSchema.safeParse({
        slug: "music-video-fast-cut",
        name: "Fast Cut Music Video",
        category: "music_video",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid slug", () => {
    expect(
      createWorkflowTemplateSchema.safeParse({
        slug: "Not A Slug!",
        name: "Bad Slug",
        category: "movie",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(
      createWorkflowTemplateSchema.safeParse({
        slug: "rogue",
        name: "Rogue",
        category: "documentary",
      }).success,
    ).toBe(false);
  });
});

describe("updateWorkflowTemplateSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      updateWorkflowTemplateSchema.safeParse({
        templateId,
        name: "Renamed",
        category: "trailer",
      }).success,
    ).toBe(true);
  });
});

describe("updateWorkflowTemplateGraphSchema", () => {
  it("accepts a valid graph", () => {
    expect(
      updateWorkflowTemplateGraphSchema.safeParse({ templateId, graph: VALID_GRAPH })
        .success,
    ).toBe(true);
  });

  it("rejects an empty node list", () => {
    expect(
      updateWorkflowTemplateGraphSchema.safeParse({
        templateId,
        graph: { nodes: [], edges: [] },
      }).success,
    ).toBe(false);
  });
});
