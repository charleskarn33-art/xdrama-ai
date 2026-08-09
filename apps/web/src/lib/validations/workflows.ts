import { z } from "zod";

export const WORKFLOW_NODE_TYPES = ["input", "model_task", "output"] as const;
export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(WORKFLOW_NODE_TYPES),
  label: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
});
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

// Cycle detection isn't re-implemented client-side: the
// validate_workflow_graph() Postgres trigger is the single source of
// truth for graph validity (see supabase/migrations/…ai_workflow_engine.sql
// and its real-Postgres tests), and a save that violates it surfaces that
// error to the user rather than silently disagreeing with the database.
export const workflowGraphSchema = z.object({
  nodes: z.array(workflowNodeSchema).min(1, "A workflow needs at least one node"),
  edges: z.array(workflowEdgeSchema),
});
export type WorkflowGraph = z.infer<typeof workflowGraphSchema>;

export const createWorkflowFromTemplateSchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200),
});
export type CreateWorkflowFromTemplateInput = z.infer<
  typeof createWorkflowFromTemplateSchema
>;

export const updateWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200).optional(),
  graph: workflowGraphSchema.optional(),
});
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

export const deleteWorkflowSchema = z.object({ workflowId: z.string().uuid() });

export const createRenderJobSchema = z.object({
  projectId: z.string().uuid(),
  workflowId: z.string().uuid(),
});
export type CreateRenderJobInput = z.infer<typeof createRenderJobSchema>;
