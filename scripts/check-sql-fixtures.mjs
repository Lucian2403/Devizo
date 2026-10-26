import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Cheap preflight for our PostgreSQL test fixtures. Not a PostgreSQL type checker:
 * the database integration test is still the source of truth.
 */

function readParentheses(sql, position) {
  if (sql[position] !== "(") return null;
  let depth = 0;
  let quoted = null;
  for (let i = position; i < sql.length; i += 1) {
    const char = sql[i];
    if (quoted) {
      if (char === quoted) {
        if (sql[i + 1] === quoted) i += 1;
        else quoted = null;
      }
      continue;
    }
    if (char === "'" || char === '"') { quoted = char; continue; }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return { inner: sql.slice(position + 1, i), end: i + 1 };
    }
  }
  return null;
}

function countFields(sql) {
  if (!sql.trim()) return 0;
  let count = 1;
  let depth = 0;
  let quoted = null;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (quoted) {
      if (char === quoted) {
        if (sql[i + 1] === quoted) i += 1;
        else quoted = null;
      }
      continue;
    }
    if (char === "'" || char === '"') { quoted = char; continue; }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) count += 1;
  }
  return count;
}

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

  // Catch column-count errors in literal INSERT ... VALUES fixtures early.
  for (const match of sql.matchAll(/^\s*INSERT\s+INTO\s+(?:public\.)?[\w."]+\s*\(/gim)) {
    const columns = readParentheses(
      sql, match.index + match[0].lastIndexOf("("),
    );
    if (!columns) continue;
    const after = sql.slice(columns.end).match(/^\s*VALUES\s*\(/i);
    if (!after) continue;
    const tuple = readParentheses(
      sql, columns.end + after[0].lastIndexOf("("),
    );
    if (!tuple) continue;
    const expected = countFields(columns.inner);
    const actual = countFields(tuple.inner);
    if (expected !== actual) {
      const line = sql.slice(0, match.index).split("\n").length;
      issues.push(
        "INSERT at line " + line + " has " + expected +
        " target columns but " + actual + " VALUES expressions",
      );
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

assert.deepEqual(
  checkFixture("INSERT INTO public.t (a, b, c) VALUES (1, 2);"),
  ["INSERT at line 1 has 3 target columns but 2 VALUES expressions"],
);

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
