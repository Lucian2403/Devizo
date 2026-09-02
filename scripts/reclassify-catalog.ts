/**
 * One-off catalog reclassification (M5.1 prerequisite).
 *
 * The Reppero-Test catalog was seeded with every item defaulting to `labor`.
 * The code convention marks materials with a `MAT-` prefix, so we set
 * item_type = 'material' for those and leave the renovation operations as
 * 'labor'. Idempotent: re-running only touches rows that are still wrong.
 *
 * Run with:
 *   npx --yes pnpm@9.12.0 tsx scripts/reclassify-catalog.ts
 */

import { config } from "dotenv";
// Load secrets before importing anything that validates env at module load.
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../infrastructure/db");
  const schema = await import("../infrastructure/db/schema");
  const { sql, and, ilike, ne, eq } = await import("drizzle-orm");

  const { catalogItems } = schema;

  // Promote every MAT- coded row that is not already a material.
  const updated = await db
    .update(catalogItems)
    .set({ itemType: "material" })
    .where(
      and(
        ilike(catalogItems.code, "MAT-%"),
        ne(catalogItems.itemType, "material"),
      ),
    )
    .returning({ id: catalogItems.id });

  console.log(`Reclassified ${updated.length} item(s) to 'material'.`);

  // Verify counts of labor vs material.
  const counts = await db
    .select({
      itemType: catalogItems.itemType,
      count: sql<number>`count(*)::int`,
    })
    .from(catalogItems)
    .groupBy(catalogItems.itemType);

  console.log("\nCounts by type:");
  for (const row of counts) console.log(`  ${row.itemType}: ${row.count}`);

  // A few examples from each type.
  const materials = await db
    .select({ code: catalogItems.code, name: catalogItems.name, unit: catalogItems.unit })
    .from(catalogItems)
    .where(eq(catalogItems.itemType, "material"))
    .limit(5);
  const labor = await db
    .select({ code: catalogItems.code, name: catalogItems.name, unit: catalogItems.unit })
    .from(catalogItems)
    .where(eq(catalogItems.itemType, "labor"))
    .limit(5);

  console.log("\nSample materials:");
  for (const r of materials) console.log(`  ${r.code}\t${r.name} [${r.unit}]`);
  console.log("\nSample labor:");
  for (const r of labor) console.log(`  ${r.code}\t${r.name} [${r.unit}]`);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
