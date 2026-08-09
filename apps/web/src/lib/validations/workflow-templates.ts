import { z } from "zod";

import { workflowGraphSchema } from "@/lib/validations/workflows";

// Matches the workflow_templates.category check constraint exactly (see
// supabase/migrations/…ai_workflow_engine.sql).
export const TEMPLATE_CATEGORIES = [
  "movie",
  "trailer",
  "commercial",
  "music_video",
  "animation",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const createWorkflowTemplateSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  name: z.string().trim().min(1, "Enter a name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.enum(TEMPLATE_CATEGORIES),
});
export type CreateWorkflowTemplateInput = z.infer<typeof createWorkflowTemplateSchema>;

export const updateWorkflowTemplateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.enum(TEMPLATE_CATEGORIES),
});
export type UpdateWorkflowTemplateInput = z.infer<typeof updateWorkflowTemplateSchema>;

export const updateWorkflowTemplateGraphSchema = z.object({
  templateId: z.string().uuid(),
  graph: workflowGraphSchema,
});
export type UpdateWorkflowTemplateGraphInput = z.infer<
  typeof updateWorkflowTemplateGraphSchema
>;

export const deleteWorkflowTemplateSchema = z.object({ templateId: z.string().uuid() });
