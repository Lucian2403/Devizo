import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CALCULATION_RULE_TYPES,
  PROFESSIONAL_RESOURCE_TYPES,
} from "../domain/professional-estimates/types";

const schema = readFileSync(
  join(process.cwd(), "infrastructure/db/schema/professionalEstimates.ts"),
  "utf8",
);
const migration = readFileSync(
  join(process.cwd(), "infrastructure/db/migrations/0014_professional_foundation.sql"),
  "utf8",
);

assert.ok(PROFESSIONAL_RESOURCE_TYPES.includes("labor"));
assert.ok(PROFESSIONAL_RESOURCE_TYPES.includes("material"));
assert.ok(PROFESSIONAL_RESOURCE_TYPES.includes("machinery"));
assert.ok(CALCULATION_RULE_TYPES.includes("overhead"));
assert.ok(CALCULATION_RULE_TYPES.includes("estimated_profit"));

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
  assert.ok(migration.includes(table), `missing professional table ${table}`);
}

assert.ok(schema.includes("basisQuantity"));
assert.ok(schema.includes("quantityPerNormBasis"));
assert.ok(schema.includes("positionNumber"));
assert.ok(schema.includes('namespace: text("namespace")'));
assert.ok(schema.includes('sourceId: uuid("source_id").notNull()'));
assert.ok(schema.includes("'overhead'"));
assert.ok(schema.includes("'estimated_profit'"));
assert.equal(schema.includes("unitPrice"), false);

for (const forbidden of ["catalog_items", "quote_items", "selling_price"]) {
  assert.equal(
    migration.includes(forbidden),
    false,
    `professional migration must not reference commercial table/field: ${forbidden}`,
  );
}

assert.ok(migration.includes("calculation_rules_source_org_fkey"));
assert.ok(migration.includes("resource_consumptions_norm_position_unique"));

console.log("M8.0 professional-domain boundary checks passed.");
