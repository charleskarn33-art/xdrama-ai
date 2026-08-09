import { z } from "zod";

export const createVoiceLineSchema = z.object({
  projectId: z.string().uuid(),
  characterId: z.string().uuid().optional().or(z.literal("")),
  shotId: z.string().uuid().optional().or(z.literal("")),
  lineOrder: z.number().int(),
  text: z.string().trim().min(1, "Enter the dialogue").max(4000),
});
export type CreateVoiceLineInput = z.infer<typeof createVoiceLineSchema>;

export const updateVoiceLineSchema = createVoiceLineSchema
  .omit({ projectId: true })
  .extend({ voiceLineId: z.string().uuid() });
export type UpdateVoiceLineInput = z.infer<typeof updateVoiceLineSchema>;

export const deleteVoiceLineSchema = z.object({
  voiceLineId: z.string().uuid(),
});

export const createMusicTrackSchema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Enter a name").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateMusicTrackInput = z.infer<typeof createMusicTrackSchema>;

export const updateMusicTrackSchema = createMusicTrackSchema
  .omit({ projectId: true })
  .extend({ musicTrackId: z.string().uuid() });
export type UpdateMusicTrackInput = z.infer<typeof updateMusicTrackSchema>;

export const deleteMusicTrackSchema = z.object({
  musicTrackId: z.string().uuid(),
});

export const createSubtitleSchema = z
  .object({
    timelineId: z.string().uuid(),
    voiceLineId: z.string().uuid().optional().or(z.literal("")),
    startSeconds: z.number().min(0),
    endSeconds: z.number().positive(),
    text: z.string().trim().min(1, "Enter the caption text").max(500),
  })
  .refine((data) => data.endSeconds > data.startSeconds, {
    message: "End must be after start",
    path: ["endSeconds"],
  });
export type CreateSubtitleInput = z.infer<typeof createSubtitleSchema>;

export const deleteSubtitleSchema = z.object({ subtitleId: z.string().uuid() });
