import { z } from "zod";

export const ADVISOR_ROLES = [
  "director",
  "cinematographer",
  "producer",
] as const;
export type AdvisorRole = (typeof ADVISOR_ROLES)[number];

export const requestSuggestionsSchema = z.object({
  projectId: z.string().uuid(),
  role: z.enum(ADVISOR_ROLES),
});
export type RequestSuggestionsInput = z.infer<typeof requestSuggestionsSchema>;
