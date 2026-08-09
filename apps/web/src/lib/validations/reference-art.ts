import { z } from "zod";

export const REFERENCE_ART_SUBJECT_TYPES = [
  "character",
  "location",
  "prop",
] as const;
export type ReferenceArtSubjectType =
  (typeof REFERENCE_ART_SUBJECT_TYPES)[number];

export const generateReferenceArtSchema = z.object({
  projectId: z.string().uuid(),
  subjectType: z.enum(REFERENCE_ART_SUBJECT_TYPES),
  subjectId: z.string().uuid(),
  subjectName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type GenerateReferenceArtInput = z.infer<
  typeof generateReferenceArtSchema
>;
