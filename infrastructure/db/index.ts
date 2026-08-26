import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// The Supabase session pooler only allows 15 concurrent session slots, so keep
// our own pool small and well below that. Next.js dev hot-reload re-imports this
// module on every change; without a cached singleton each reload would open a
// brand-new pool and leak the old connections until the pooler runs out.
const globalForDb = globalThis as unknown as {
  dbClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.dbClient ??
  postgres(env.DATABASE_URL, { prepare: false, max: 5, idle_timeout: 20 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbClient = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
