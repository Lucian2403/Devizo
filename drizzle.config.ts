import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./infrastructure/db/schema/index.ts",
  out: "./infrastructure/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Application tables only. Supabase owns the auth schema.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
