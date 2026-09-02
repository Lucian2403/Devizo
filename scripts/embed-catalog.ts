/**
 * One-off / repeatable catalog embedding backfill (M5.1).
 *
 * For every organization it embeds catalog items whose semantic hash changed
 * (or were never embedded). Safe to re-run — unchanged rows are skipped.
 *
 * Prerequisite guard (requirement 4): if an org has items but ZERO material
 * items, its catalog is almost certainly still mis-classified (everything left
 * as the default `labor`). Embedding such a catalog bakes in the wrong types,
 * so we SKIP it and print a warning. Pass --force to embed anyway.
 *
 * Run with:
 *   npx --yes pnpm@9.12.0 tsx scripts/embed-catalog.ts
 *   npx --yes pnpm@9.12.0 tsx scripts/embed-catalog.ts --force
 */

import { config } from "dotenv";
// Load secrets before importing anything that validates env at module load.
config({ path: ".env.local" });

const FORCE = process.argv.includes("--force");

async function main() {
  const { db } = await import("../infrastructure/db");
  const schema = await import("../infrastructure/db/schema");
  const { sql, eq, and } = await import("drizzle-orm");
  const { DrizzleCatalogItemRepository } = await import(
    "../infrastructure/db/repositories/catalogItem.repository"
  );
  const { CatalogEmbeddingService } = await import(
    "../domain/ai/catalogEmbedding"
  );
  const { CatalogEmbeddingSyncService } = await import(
    "../domain/catalog/embeddingSync.service"
  );
  const { GeminiEmbeddingProvider } = await import(
    "../infrastructure/ai/gemini/embedding.provider"
  );

  const { catalogItems } = schema;

  // Per-organization labor/material counts over active items.
  const counts = await db
    .select({
      organizationId: catalogItems.organizationId,
      itemType: catalogItems.itemType,
      count: sql<number>`count(*)::int`,
    })
    .from(catalogItems)
    .where(eq(catalogItems.active, true))
    .groupBy(catalogItems.organizationId, catalogItems.itemType);

  const byOrg = new Map<string, { labor: number; material: number }>();
  for (const row of counts) {
    const entry = byOrg.get(row.organizationId) ?? { labor: 0, material: 0 };
    if (row.itemType === "material") entry.material = row.count;
    else entry.labor = row.count;
    byOrg.set(row.organizationId, entry);
  }

  if (byOrg.size === 0) {
    console.log("No active catalog items found. Nothing to embed.");
    return;
  }

  const provider = new GeminiEmbeddingProvider();
  const sync = new CatalogEmbeddingSyncService(
    new DrizzleCatalogItemRepository(),
    new CatalogEmbeddingService(provider),
  );

  console.log(`Embedding model: ${provider.model} (${provider.dimensions}d)\n`);

  let totalEmbedded = 0;
  for (const [orgId, { labor, material }] of byOrg) {
    const mislabeled = material === 0 && labor > 0;
    if (mislabeled && !FORCE) {
      console.warn(
        `SKIP org ${orgId}: ${labor} labor, 0 material items. ` +
          `Catalog looks mis-classified — reclassify materials first, ` +
          `or re-run with --force.`,
      );
      continue;
    }

    const { embedded, skipped } = await sync.syncOrganization(orgId);
    totalEmbedded += embedded;
    console.log(
      `org ${orgId}: embedded ${embedded}, skipped ${skipped} ` +
        `(labor ${labor}, material ${material})${mislabeled ? " [FORCED]" : ""}`,
    );
  }

  console.log(`\nDone. Embedded ${totalEmbedded} item(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
