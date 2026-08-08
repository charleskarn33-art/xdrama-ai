import { z } from "zod";

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Enter an organization name").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a URL slug")
    .max(60)
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Lowercase letters, numbers, and hyphens only",
    ),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
