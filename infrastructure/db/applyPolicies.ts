import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * Applies version-controlled RLS/policy SQL files. Kept separate from the
 * Drizzle schema migrator because these reference the Supabase auth schema.
 * Statements are written to be safe to run, but run after `db:migrate`.
 */
async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const dir = join(process.cwd(), "infrastructure/db/policies");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  const client = postgres(url, { max: 1 });
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    await client.unsafe(sql);
    console.log(`Applied policy file: ${file}`);
  }
  await client.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
