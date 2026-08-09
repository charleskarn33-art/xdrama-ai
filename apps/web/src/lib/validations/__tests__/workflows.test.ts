import { describe, expect, it } from "vitest";

import {
  createRenderJobSchema,
  createWorkflowFromTemplateSchema,
  updateWorkflowSchema,
  workflowGraphSchema,
} from "@/lib/validations/workflows";

const uuid1 = "11111111-1111-4111-8111-111111111111";
const uuid2 = "22222222-2222-4222-8222-222222222222";

const VALID_GRAPH = {
  nodes: [
    { id: "a", type: "input", position: { x: 0, y: 0 }, config: { key: "script" } },
    {
      id: "b",
      type: "model_task",
      position: { x: 200, y: 0 },
      config: { taskType: "movie", params: {} },
    },
    { id: "c", type: "output", position: { x: 400, y: 0 }, config: { key: "video" } },
  ],
  edges: [
    { id: "e1", source: "a", target: "b" },
    { id: "e2", source: "b", target: "c" },
  ],
};

describe("workflowGraphSchema", () => {
  it("accepts a valid graph", () => {
    expect(workflowGraphSchema.safeParse(VALID_GRAPH).success).toBe(true);
  });

  it("rejects a graph with no nodes", () => {
    expect(
      workflowGraphSchema.safeParse({ nodes: [], edges: [] }).success,
    ).toBe(false);
  });

  it("rejects a node with an invalid type", () => {
    const graph = {
      nodes: [{ id: "a", type: "bogus", position: { x: 0, y: 0 }, config: {} }],
      edges: [],
    };
    expect(workflowGraphSchema.safeParse(graph).success).toBe(false);
  });

  it("defaults config to an empty object", () => {
    const result = workflowGraphSchema.safeParse({
      nodes: [{ id: "a", type: "input", position: { x: 0, y: 0 } }],
      edges: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0]?.config).toEqual({});
    }
  });
});

describe("createWorkflowFromTemplateSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createWorkflowFromTemplateSchema.safeParse({
        projectId: uuid1,
        templateId: uuid2,
        name: "My Movie Workflow",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      createWorkflowFromTemplateSchema.safeParse({
        projectId: uuid1,
        templateId: uuid2,
        name: "",
      }).success,
    ).toBe(false);
  });
});

describe("updateWorkflowSchema", () => {
  it("accepts a name-only update", () => {
    expect(
      updateWorkflowSchema.safeParse({ workflowId: uuid1, name: "Renamed" }).success,
    ).toBe(true);
  });

  it("accepts a graph-only update", () => {
    expect(
      updateWorkflowSchema.safeParse({ workflowId: uuid1, graph: VALID_GRAPH })
        .success,
    ).toBe(true);
  });
});

describe("createRenderJobSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createRenderJobSchema.safeParse({ projectId: uuid1, workflowId: uuid2 })
        .success,
    ).toBe(true);
  });

  it("rejects a non-uuid workflowId", () => {
    expect(
      createRenderJobSchema.safeParse({ projectId: uuid1, workflowId: "nope" })
        .success,
    ).toBe(false);
  });
});
