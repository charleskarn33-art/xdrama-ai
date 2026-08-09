import { z } from "zod";

export const createTimelineSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateTimelineInput = z.infer<typeof createTimelineSchema>;

export const updateTimelineSchema = createTimelineSchema
  .omit({ projectId: true })
  .extend({ timelineId: z.string().uuid() });
export type UpdateTimelineInput = z.infer<typeof updateTimelineSchema>;

export const deleteTimelineSchema = z.object({ timelineId: z.string().uuid() });

export const TRANSITION_TYPES = ["cut", "fade", "dissolve", "wipe"] as const;

const trimFields = {
  trimStartSeconds: z.number().min(0).optional(),
  trimEndSeconds: z.number().positive().optional(),
};

function trimOrdered(data: {
  trimStartSeconds?: number;
  trimEndSeconds?: number;
}) {
  return (
    data.trimStartSeconds === undefined ||
    data.trimEndSeconds === undefined ||
    data.trimEndSeconds > data.trimStartSeconds
  );
}

export const addClipSchema = z
  .object({
    timelineId: z.string().uuid(),
    shotId: z.string().uuid(),
    clipOrder: z.number().int(),
    // No .default() here: it would make the schema's *input* type
    // optional but its *output* type required, which useForm's
    // generic (bound to the resolver's input type) can't express
    // cleanly. The caller always supplies a value (the form's
    // defaultValues, or the "cut" fallback in the AddClipInput type).
    transitionIn: z.enum(TRANSITION_TYPES),
    ...trimFields,
  })
  .refine(trimOrdered, {
    message: "Trim end must be after trim start",
    path: ["trimEndSeconds"],
  });
export type AddClipInput = z.infer<typeof addClipSchema>;

export const updateClipSchema = z
  .object({
    clipId: z.string().uuid(),
    clipOrder: z.number().int(),
    transitionIn: z.enum(TRANSITION_TYPES),
    ...trimFields,
  })
  .refine(trimOrdered, {
    message: "Trim end must be after trim start",
    path: ["trimEndSeconds"],
  });
export type UpdateClipInput = z.infer<typeof updateClipSchema>;

export const deleteClipSchema = z.object({ clipId: z.string().uuid() });
