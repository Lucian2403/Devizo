import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Cheap preflight for our PostgreSQL test fixtures. Not a PostgreSQL type checker:
 * the database integration test is still the source of truth.
 */
export function checkFixture(sql) {
  const issues = [];
  // A lost dollar-quote terminator caused a confusing downstream DECLARE error.
  if ((sql.match(/\$\$/g) ?? []).length % 2 !== 0) {
    issues.push("unpaired $$ SQL delimiter");
  }

  for (const block of sql.matchAll(/\bDO\s+\$\$([\s\S]*?)\$\$\s*;/gi)) {
    const body = block[1];
    const declaration = body.match(/^\s*DECLARE\b([\s\S]*?)^\s*BEGIN\b/im);
    if (!declaration) continue;

    const variables = new Set(
      [...declaration[1].matchAll(/^\s*([a-z_]\w*)\s+(?:record|[a-z_]\w*(?:\[\])?)\b/gim)]
        .map((match) => match[1].toLowerCase()),
    );
    for (const match of body.matchAll(
      /\b(?:FROM|JOIN)\s+(?:[a-z_]\w*\.)?[a-z_]\w*\s+(?:AS\s+)?([a-z_]\w*)\b/gi,
    )) {
      const alias = match[1].toLowerCase();
      if (variables.has(alias)) {
        issues.push(
          `PL/pgSQL variable "${alias}" is also a SQL table alias inside the same DO block`,
        );
      }
    }
  }

  return [...new Set(issues)];
}

// Keep small regression examples so the checker itself cannot silently regress.
assert.deepEqual(
  checkFixture("DO $$\nDECLARE\n  own record;\nBEGIN\n  SELECT own.id FROM fixtures own;\nEND\n$$;"),
  ['PL/pgSQL variable "own" is also a SQL table alias inside the same DO block'],
);
assert.deepEqual(
  checkFixture("DO $$\nDECLARE\n  own record;\nBEGIN\n  SELECT row_id FROM fixtures source_fixture;\nEND\n$$;"),
  [],
);
assert.deepEqual(checkFixture("DO $$ BEGIN NULL; END $;"), ["unpaired $$ SQL delimiter"]);

const directory = "scripts";
const fixtures = readdirSync(directory).filter((name) => name.endsWith(".sql"));
const violations = [];
for (const filename of fixtures) {
  const path = join(directory, filename);
  const issues = checkFixture(readFileSync(path, "utf8"));
  for (const issue of issues) violations.push(`${path}: ${issue}`);
}
if (violations.length) {
  for (const violation of violations) console.error(violation);
  process.exitCode = 1;
} else {
  console.log(`SQL fixture preflight passed (${fixtures.length} files). PostgreSQL execution is still required.`);
}
