import { z } from "zod";

export const PROJECT_STATUSES = [
  "draft",
  "in_progress",
  "completed",
  "archived",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const createProjectSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a project name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a project name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(PROJECT_STATUSES),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const deleteProjectSchema = z.object({
  projectId: z.string().uuid(),
});

export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
