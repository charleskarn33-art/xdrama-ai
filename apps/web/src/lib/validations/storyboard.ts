import { z } from "zod";

export const createSceneSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sceneOrder: z.number().int(),
  scriptId: z.string().uuid().optional().or(z.literal("")),
  locationId: z.string().uuid().optional().or(z.literal("")),
});
export type CreateSceneInput = z.infer<typeof createSceneSchema>;

export const updateSceneSchema = createSceneSchema
  .omit({ projectId: true })
  .extend({ sceneId: z.string().uuid() });
export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;

export const deleteSceneSchema = z.object({ sceneId: z.string().uuid() });

export const SHOT_TYPES = [
  "wide",
  "medium",
  "close_up",
  "extreme_close_up",
  "pov",
  "over_the_shoulder",
  "aerial",
] as const;

export const createShotSchema = z.object({
  sceneId: z.string().uuid(),
  shotOrder: z.number().int(),
  shotType: z.enum(SHOT_TYPES).optional().or(z.literal("")),
  description: z.string().trim().min(1, "Describe the shot").max(2000),
  durationSeconds: z.number().positive().optional(),
});
export type CreateShotInput = z.infer<typeof createShotSchema>;

export const updateShotSchema = createShotSchema
  .omit({ sceneId: true })
  .extend({ shotId: z.string().uuid() });
export type UpdateShotInput = z.infer<typeof updateShotSchema>;

export const deleteShotSchema = z.object({ shotId: z.string().uuid() });

export const addShotCharacterSchema = z.object({
  shotId: z.string().uuid(),
  characterId: z.string().uuid(),
});
export type AddShotCharacterInput = z.infer<typeof addShotCharacterSchema>;

export const removeShotCharacterSchema = z.object({
  shotId: z.string().uuid(),
  characterId: z.string().uuid(),
});
