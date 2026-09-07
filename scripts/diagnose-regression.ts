/**
 * TEMPORARY diagnostic (not a unit test). Runs the three regression inputs
 * end-to-end through the REAL Gemini extraction + the org's live catalog, and
 * prints all six requested stages per test.
 *
 * It does NOT change any data. Delete after verification.
 *
 * Run with:
 *   npx --yes pnpm@9.12.0 tsx scripts/diagnose-regression.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const INPUTS: { id: string; text: string }[] = [
  {
    id: "TEST 1 — room geometry + wall/ceiling",
    text: "Camera are 5.2 pe 3.8, înălțimea 2.72. Avem o fereastră 1.6 pe 1.4 și o ușă 0.9 pe 2.05. Pereții trebuie gletuiți și vopsiți în două mâini, iar tavanul doar amorsă și vopsit.",
  },
  {
    id: "TEST 2 — drywall wall with explicit scope",
    text: "Facem un perete de 4.30 lungime și 2.65 înălțime. Gips-carton dublu pe ambele părți, vată minerală de 75 înăuntru și o ușă de 80 pe 2 m. Profil normal de 75.",
  },
  {
    id: "TEST 3 — mixed flooring / bathroom / electrical",
    text: "Apartament de 62 m. În două dormitoare, în total 31 m2. Scoatem laminatul și punem laminat nou. Livingul are 19 m2, tot laminat. Bucătăria 9 m2 gresie. Baia 5 m2 podea și cam 22 m2 pereți, ceramică peste tot. Pereții în camere și living au cam 180 m2, glet și două mâini de vopsea. Mai avem 18 prize și 7 întrerupătoare.",
  },
];

function j(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const { db } = await import("../infrastructure/db");
  const schema = await import("../infrastructure/db/schema");
  const { eq, sql } = await import("drizzle-orm");
  const { GeminiExtractionProvider } = await import(
    "../infrastructure/ai/gemini/extraction.provider"
  );
  const { GeminiEmbeddingProvider } = await import(
    "../infrastructure/ai/gemini/embedding.provider"
  );
  const { DrizzleCatalogItemRepository } = await import(
    "../infrastructure/db/repositories/catalogItem.repository"
  );
  const { EstimateAssistantService } = await import(
    "../domain/ai/estimate.service"
  );
  const { computeSurfaceArea } = await import("../domain/quotes/geometry");

  const { organizations, catalogItems } = schema;

  // Pick the org with the most active catalog items (the real pilot catalog).
  const counts = await db
    .select({
      organizationId: catalogItems.organizationId,
      count: sql<number>`count(*)::int`,
    })
    .from(catalogItems)
    .where(eq(catalogItems.active, true))
    .groupBy(catalogItems.organizationId);

  if (counts.length === 0) {
    console.log("No active catalog items in any org. Cannot diagnose.");
    return;
  }
  counts.sort((a, b) => b.count - a.count);
  const orgId = counts[0]!.organizationId;

  const org = (
    await db.select().from(organizations).where(eq(organizations.id, orgId))
  )[0];
  const catalogLanguage = org?.defaultLanguage ?? "ro";
  console.log(
    `Using org ${orgId} (${org?.name ?? "?"}), catalog language ${catalogLanguage}, ` +
      `${counts[0]!.count} active items.\n`,
  );

  const extractionProvider = new GeminiExtractionProvider();
  const catalogRepo = new DrizzleCatalogItemRepository();
  const service = new EstimateAssistantService(
    extractionProvider,
    catalogRepo,
    new GeminiEmbeddingProvider(),
  );

  for (const input of INPUTS) {
    console.log("=".repeat(80));
    console.log(input.id);
    console.log("INPUT:", input.text);
    console.log("-".repeat(80));

    // (1) Raw validated extraction, straight from the provider (pre-matching),
    //     so we can also show (2) the geometry block the model emitted and
    //     (3) the deterministic area for that geometry.
    const raw = await extractionProvider.extract(input.text, {
      catalogLanguage: catalogLanguage as never,
    });
    console.log("\n[1] RAW VALIDATED EXTRACTION:");
    console.log(j(raw));

    console.log("\n[2] GEOMETRY BLOCKS + [3] DETERMINISTIC QUANTITY:");
    raw.items.forEach((it, i) => {
      if (!it.geometry) {
        console.log(`  item[${i}] ${it.concept}: no geometry`);
        return;
      }
      const area = computeSurfaceArea(it.geometry.shape, {
        length: it.geometry.length,
        width: it.geometry.width,
        height: it.geometry.height,
        openings: it.geometry.openings.map((o) => ({
          width: o.width,
          height: o.height,
          count: o.count ?? 1,
        })),
      });
      console.log(
        `  item[${i}] ${it.concept}: geometry=${j(it.geometry)} => area=${area}`,
      );
    });

    // Full pipeline (extraction is run again inside assist; that's fine — we
    // only need its matched output here for stages 4-6).
    const result = await service.assist(
      orgId as never,
      catalogLanguage as never,
      input.text,
    );

    console.log("\n[4] CANDIDATES + [5] SELECTED/SUGGESTED + quantities:");
    result.items.forEach((m, i) => {
      console.log(
        `  item[${i}] "${m.item.concept}" [${m.item.action}/${m.item.object}/${m.item.surface}] ` +
          `qty=${m.item.quantity} unit=${m.item.unit} status=${m.status} ` +
          `suggested=${m.suggestedCatalogItemId}`,
      );
      m.candidates.forEach((c) => {
        const mark = c.catalogItemId === m.suggestedCatalogItemId ? " *" : "  ";
        console.log(
          `${mark}   cand ${c.catalogItemId} "${c.name}" ${c.unit} ` +
            `${c.sellingPrice} score=${c.score.toFixed(3)}`,
        );
      });
    });

    console.log("\n[6] FINAL USER-FACING ROWS (as the review UI would seed):");
    result.items.forEach((m) => {
      const top = m.candidates.find(
        (c) => c.catalogItemId === m.suggestedCatalogItemId,
      );
      const include = m.status !== "unmatched";
      const name = top?.name ?? (m.item.description || m.item.concept);
      const unit = top?.unit ?? m.item.unit ?? "pcs";
      const price = top?.sellingPrice ?? "(manual)";
      console.log(
        `  ${include ? "[x]" : "[ ]"} ${name} | qty=${m.item.quantity ?? ""} ${unit} ` +
          `| price=${price}`,
      );
    });
    console.log("");
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
