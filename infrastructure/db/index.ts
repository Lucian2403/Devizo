import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";
import {
  canUsePreparedStatements,
  preferPreparedStatements,
} from "./prepared-statements";

type Client = ReturnType<typeof postgres>;

// The Supabase session pooler only allows 15 concurrent session slots, so keep
// our own pool small and well below that. Next.js dev hot-reload re-imports this
// module on every change; without a cached singleton each reload would open a
// brand-new pool and leak the old connections until the pooler runs out.
const globalForDb = globalThis as unknown as {
  dbClient?: Client;
};

// In development nothing else shares the pooler, and a closed pool costs a
// fresh TLS + auth handshake (~0.4s) on the next click, so keep idle
// connections around much longer than in production.
const idleTimeoutSeconds = process.env.NODE_ENV === "production" ? 20 : 120;

function createClient(): Client {
  const usePrepared = canUsePreparedStatements(env.DATABASE_URL);
  const created = postgres(env.DATABASE_URL, {
    prepare: usePrepared,
    max: 5,
    idle_timeout: idleTimeoutSeconds,
  });
  return usePrepared ? preferPreparedStatements(created) : created;
}

const client = globalForDb.dbClient ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbClient = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;