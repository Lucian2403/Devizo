import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Single shared connection for the app. postgres-js handles pooling.
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });

export type Database = typeof db;
