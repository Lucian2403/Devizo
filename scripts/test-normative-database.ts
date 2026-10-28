import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
    const testRoles = await client`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
    `;
    if (!testRoles.some((role) => role.rolname === "anon")) {
      await client.unsafe("CREATE ROLE anon NOLOGIN");
    }
    if (!testRoles.some((role) => role.rolname === "authenticated")) {
      await client.unsafe("CREATE ROLE authenticated NOLOGIN");
    }
    if (!testRoles.some((role) => role.rolname === "service_role")) {
      await client.unsafe("CREATE ROLE service_role NOLOGIN");
    }
    // Insert real pre-M8.4D rows before applying its new semantic columns.
    const migrationsFolder = "infrastructure/db/migrations";
    const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const baseline = mkdtempSync(join(tmpdir(), "devizo-m84d-migrations-"));
    try {
      mkdirSync(join(baseline, "meta"));
      const entries = journal.entries.filter((entry) => entry.idx < 19);
      for (const entry of entries) {
        copyFileSync(join(migrationsFolder, `${entry.tag}.sql`), join(baseline, `${entry.tag}.sql`));
      }
      writeFileSync(join(baseline, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
      await migrate(drizzle(client), { migrationsFolder: baseline });
    } finally {
      rmSync(baseline, { recursive: true });
    }
    await client.unsafe(readFileSync("scripts/test-procurement-legacy-data.sql", "utf8"));
    await migrate(drizzle(client), { migrationsFolder });
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
    const fixtureFiles = [
      "test-normative-database.sql",
      "test-professional-norm-lifecycle.sql",
      "test-professional-procurement-database.sql",
      "test-professional-cost-component-decisions-database.sql",
      "test-professional-object-estimates-database.sql",
      "test-professional-general-estimates-database.sql",
      "test-professional-temporary-works-database.sql",
      "test-professional-winter-rules-database.sql",
      "test-professional-winter-decisions-database.sql",
    ];
    for (const file of fixtureFiles) {
      const path = join("scripts", file);
      console.log(`Checking ${path}...`);
      try {
        await client.unsafe(readFileSync(path, "utf8"));
      } catch (error) {
        // Identify the file without exposing connection strings or SQL contents.
        const detail = error instanceof Error ? error.message : "Unknown SQL error";
        throw new Error(`${path}: ${detail}`);
      }
    }
    console.log("M8.4D legacy migration defaults, semantic CHECK constraints and organization RLS checks passed.");
    console.log("M8.4E component decision constraints, organization relationships, uniqueness and RLS checks passed.");
    console.log("M8.5A object estimate constraints, organization relationships, uniqueness and RLS checks passed.");
    console.log("M8.5B general estimate constraints, organization relationships, uniqueness and RLS checks passed.");
    console.log("M8.5C1 temporary works rule/decision constraints, organization relationships and RLS checks passed.");
    console.log("M8.5C2B1 winter rule component CHECK, pack uniqueness and RLS guards passed.");
    console.log("M8.5C2B2 winter decision shape, FK, uniqueness and tenant RLS guards passed.");
    console.log("Database guards, membership lifecycle, provenance, draft-only consumptions, rule-definition constraints, M8.4B norm publication lifecycle and RLS checks passed.");
    console.log("Test mutations rolled back; legacy migration fixtures remain in the disposable database.");
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
