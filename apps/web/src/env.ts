import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  AI_ORCHESTRATOR_URL: z.string().url().default("http://localhost:8000"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const clientEnv = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!clientEnv.success) {
  console.error(
    "Invalid client environment variables:",
    clientEnv.error.flatten().fieldErrors,
  );
  throw new Error("Invalid client environment variables. See .env.example.");
}

export const publicEnv = clientEnv.data;

/**
 * Server-only env. Import only from server components, route handlers,
 * or server actions — never from a "use client" module.
 */
export function getServerEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AI_ORCHESTRATOR_URL: process.env.AI_ORCHESTRATOR_URL,
  });

  if (!parsed.success) {
    console.error(
      "Invalid server environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid server environment variables. See .env.example.");
  }

  return parsed.data;
}
