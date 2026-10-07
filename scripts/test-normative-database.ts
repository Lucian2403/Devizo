import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_TEST_URL;
  assert.ok(url, "Set DATABASE_TEST_URL to an empty disposable PostgreSQL 16 database.");
  assert.equal(
    process.env.CONFIRM_DISPOSABLE_DATABASE,
    "yes",
    "This test installs schema and policies. Set CONFIRM_DISPOSABLE_DATABASE=yes only for a disposable database.",
  );
  assert.notEqual(url, process.env.DATABASE_URL, "Do not use the application's database.");
  const client = postgres(url, { max: 1 });
  try {
    const [server] = await client`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server && server.version >= 160000 && server.version < 170000, "PostgreSQL 16 is required.");
    const [existing] = await client`SELECT count(*)::int AS tables FROM pg_tables WHERE schemaname = 'public'`;
    assert.equal(existing?.tables, 0, "Use an empty disposable database, not an existing app database.");
    const [extension] = await client`SELECT name FROM pg_available_extensions WHERE name = 'vector'`;
    assert.ok(extension, "Install pgvector on the PostgreSQL server before running.");

    // A plain PostgreSQL test database needs the two Supabase auth dependencies.
    const [auth] = await client`SELECT to_regclass('auth.users') AS users`;
    if (!auth?.users) {
      await client.unsafe(`
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (id uuid PRIMARY KEY);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
      `);
      console.log("Installed minimal test-only Supabase auth dependencies.");
    }
    await migrate(drizzle(client), { migrationsFolder: "infrastructure/db/migrations" });
    console.log("Applied the full migration chain.");
    const policiesPath = join(process.cwd(), "infrastructure/db/policies");
    for (const file of readdirSync(policiesPath).filter((file) => file.endsWith(".sql")).sort()) {
      await client.unsafe(readFileSync(join(policiesPath, file), "utf8"));
      console.log(`Applied ${file}.`);
    }
    // Exercise the idempotent governance policies/guards a second time.
    for (const file of ["0007_professional_estimates_rls.sql", "0008_normative_governance_guards.sql"]) {
      await client.unsafe(readFileSync(join(policiesPath, file), "utf8"));
    }
    await client.unsafe(readFileSync("scripts/test-normative-database.sql", "utf8"));
    console.log("Database guards, membership lifecycle, provenance, draft-only consumptions and RLS checks passed. Fixtures rolled back.");
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  // Do not print connection details (including credentials) from driver errors.
  if (error instanceof Error) console.error(`${error.name}: ${error.message}`);
  else console.error("Database validation failed.");
  process.exitCode = 1;
});
