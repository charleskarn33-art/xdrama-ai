import { z } from "zod";

export const createExportJobSchema = z.object({
  projectId: z.string().uuid(),
  timelineId: z.string().uuid(),
  presetId: z.string().uuid().optional().or(z.literal("")),
});
export type CreateExportJobInput = z.infer<typeof createExportJobSchema>;
