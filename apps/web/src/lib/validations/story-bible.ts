import { z } from "zod";

export const createCharacterSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  appearance: z.string().trim().max(2000).optional().or(z.literal("")),
  personality: z.string().trim().max(2000).optional().or(z.literal("")),
  voiceDescription: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

export const updateCharacterSchema = createCharacterSchema
  .omit({ projectId: true })
  .extend({ characterId: z.string().uuid() });
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;

export const deleteCharacterSchema = z.object({
  characterId: z.string().uuid(),
});

export const createRelationshipSchema = z.object({
  characterId: z.string().uuid(),
  relatedCharacterId: z.string().uuid(),
  relationshipType: z
    .string()
    .trim()
    .min(1, "Describe the relationship")
    .max(100),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;

export const deleteRelationshipSchema = z.object({
  relationshipId: z.string().uuid(),
});

export const createLocationSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = createLocationSchema
  .omit({ projectId: true })
  .extend({ locationId: z.string().uuid() });
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const deleteLocationSchema = z.object({ locationId: z.string().uuid() });

export const createPropSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  appearance: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreatePropInput = z.infer<typeof createPropSchema>;

export const updatePropSchema = createPropSchema
  .omit({ projectId: true })
  .extend({ propId: z.string().uuid() });
export type UpdatePropInput = z.infer<typeof updatePropSchema>;

export const deletePropSchema = z.object({ propId: z.string().uuid() });

export const createTimelineEventSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  inStoryDate: z.string().trim().max(100).optional().or(z.literal("")),
  eventOrder: z.number().int(),
});
export type CreateTimelineEventInput = z.infer<
  typeof createTimelineEventSchema
>;

export const deleteTimelineEventSchema = z.object({
  eventId: z.string().uuid(),
});

export const createNoteSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Enter a title").max(200),
  content: z.string().trim().max(10000).optional().or(z.literal("")),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = createNoteSchema
  .omit({ projectId: true })
  .extend({ noteId: z.string().uuid() });
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const deleteNoteSchema = z.object({ noteId: z.string().uuid() });
