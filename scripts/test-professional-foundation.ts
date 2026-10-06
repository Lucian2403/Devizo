import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CALCULATION_RULE_TYPES,
  NORMATIVE_SOURCE_TYPES,
  OFFICIAL_SOURCE_STATUSES,
  PROFESSIONAL_RESOURCE_TYPES,
} from "../domain/professional-estimates/types";

const schema = readFileSync(
  join(process.cwd(), "infrastructure/db/schema/professionalEstimates.ts"),
  "utf8",
);
const foundationMigration = readFileSync(
  join(
    process.cwd(),
    "infrastructure/db/migrations/0014_professional_foundation.sql",
  ),
  "utf8",
);
const normativeIntelligenceMigration = readFileSync(
  join(
    process.cwd(),
    "infrastructure/db/migrations/0015_normative_intelligence.sql",
  ),
  "utf8",
);

assert.ok(PROFESSIONAL_RESOURCE_TYPES.includes("labor"));
assert.ok(PROFESSIONAL_RESOURCE_TYPES.includes("material"));
assert.ok(PROFESSIONAL_RESOURCE_TYPES.includes("machinery"));
assert.ok(CALCULATION_RULE_TYPES.includes("overhead"));
assert.ok(CALCULATION_RULE_TYPES.includes("estimated_profit"));
assert.ok(NORMATIVE_SOURCE_TYPES.includes("normative_document"));
assert.ok(NORMATIVE_SOURCE_TYPES.includes("price_catalog"));
assert.ok(NORMATIVE_SOURCE_TYPES.includes("legislation"));
assert.ok(OFFICIAL_SOURCE_STATUSES.includes("in_force"));
assert.ok(OFFICIAL_SOURCE_STATUSES.includes("consultation"));

for (const forbidden of [
  "catalogItems",
  "catalog_items",
  "sellingPrice",
  "selling_price",
  "quoteItems",
  "quote_items",
]) {
  assert.equal(
    schema.includes(forbidden),
    false,
    `professional schema must not depend on commercial concept: ${forbidden}`,
  );
}

for (const table of [
  "construction_objects",
  "work_quantity_lists",
  "work_quantity_items",
  "normative_sources",
  "estimate_norms",
  "estimate_norm_versions",
  "professional_resources",
  "resource_consumptions",
  "resource_prices",
  "calculation_contexts",
  "norm_applications",
  "calculation_rules",
]) {
  assert.ok(
    foundationMigration.includes(table),
    `missing professional table ${table}`,
  );
}

assert.ok(schema.includes("basisQuantity"));
assert.ok(schema.includes("quantityPerNormBasis"));
assert.ok(schema.includes("positionNumber"));
assert.ok(schema.includes('namespace: text("namespace")'));
assert.ok(schema.includes('sourceId: uuid("source_id").notNull()'));
assert.ok(schema.includes("'overhead'"));
assert.ok(schema.includes("'estimated_profit'"));
assert.ok(schema.includes("normativeUpdates"));
assert.ok(schema.includes("officialStatus"));
assert.ok(schema.includes("monitoringEnabled"));
assert.ok(schema.includes("contentFingerprint"));
assert.equal(schema.includes("unitPrice"), false);

for (const forbidden of ["catalog_items", "quote_items", "selling_price"]) {
  assert.equal(
    foundationMigration.includes(forbidden),
    false,
    `professional migration must not reference commercial table/field: ${forbidden}`,
  );
}

assert.ok(
  foundationMigration.includes("calculation_rules_source_org_fkey"),
);
assert.ok(
  foundationMigration.includes("resource_consumptions_norm_position_unique"),
);
assert.ok(normativeIntelligenceMigration.includes("normative_updates"));
assert.ok(
  normativeIntelligenceMigration.includes("resource_prices_source_org_fkey"),
);
assert.ok(
  normativeIntelligenceMigration.includes(
    "normative_sources_official_status_check",
  ),
);

// Every index created by the hand-written 0015 migration must also be declared
// in the Drizzle schema, otherwise the next `drizzle-kit generate` drops it.
for (const match of normativeIntelligenceMigration.matchAll(
  /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS "([^"]+)"/g,
)) {
  assert.ok(
    schema.includes(`"${match[1]}"`),
    `index ${match[1]} is in migration 0015 but missing from the Drizzle schema`,
  );
}

// Source monitoring may only write normative source/update rows. It must never
// write norms, consumptions, prices, rules or any commercial table.
const normativeRepository = readFileSync(
  join(
    process.cwd(),
    "infrastructure/db/repositories/normativeIntelligence.repository.ts",
  ),
  "utf8",
);
const writeTargets = [
  ...normativeRepository.matchAll(/\.(?:insert|update|delete)\(\s*(\w+)\s*\)/g),
].map((match) => match[1]);
assert.ok(writeTargets.length > 0, "expected normative repository writes");
for (const target of writeTargets) {
  assert.ok(
    target === "normativeSources" || target === "normativeUpdates",
    `normative monitoring must not write to ${target}`,
  );
}

// The scheduler calls the monitor route without a session cookie; the route
// authenticates with CRON_SECRET, so the auth middleware must let it through.
const authMiddleware = readFileSync(
  join(process.cwd(), "infrastructure/supabase/middleware.ts"),
  "utf8",
);
assert.ok(authMiddleware.includes('"/api/internal/normative-monitor"'));

console.log("M8 professional-domain boundary checks passed.");
