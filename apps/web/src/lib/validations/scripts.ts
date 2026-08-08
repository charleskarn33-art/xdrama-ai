import { z } from "zod";

export const SCRIPT_STATUSES = ["draft", "final"] as const;
export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];

export const createScriptSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  content: z.string().max(200000).optional().or(z.literal("")),
});
export type CreateScriptInput = z.infer<typeof createScriptSchema>;

export const updateScriptSchema = z.object({
  scriptId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  content: z.string().max(200000).optional().or(z.literal("")),
  status: z.enum(SCRIPT_STATUSES),
});
export type UpdateScriptInput = z.infer<typeof updateScriptSchema>;

export const deleteScriptSchema = z.object({ scriptId: z.string().uuid() });
