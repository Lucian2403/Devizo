import { z } from "zod";

// We check the environment variables once, when the app starts.
// If something is missing we throw a clear error right away, instead of
// failing later somewhere deep in the code with a confusing "undefined".

// Variables needed on the server.
const serverSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // New Supabase publishable key (starts with sb_publishable_...). Browser-safe.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // New Supabase secret key (starts with sb_secret_...). Server-only.
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

// In the browser only the NEXT_PUBLIC_* variables exist.
const browserSchema = serverSchema.pick({
  NEXT_PUBLIC_SITE_URL: true,
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
});

type ServerEnv = z.infer<typeof serverSchema>;

function loadEnv(): ServerEnv {
  const runningOnServer = typeof window === "undefined";
  const schema = runningOnServer ? serverSchema : browserSchema;

  const result = schema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  // On the browser the server-only fields are absent, but the code that reads
  // them only runs on the server, so treating them as present here is safe.
  return result.data as ServerEnv;
}

export const env = loadEnv();
