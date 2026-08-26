/**
 * Seed script: adds a few sample quotes (devize) to projects that don't have
 * any yet. Uses the deterministic pricing engine so totals match the app.
 * Dev/demo only — targets the first organization found.
 *
 * Run with:
 *   npx --yes pnpm@9.12.0 tsx infrastructure/db/seed-quotes.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { asc, eq } from "drizzle-orm";
import * as schema from "./schema";
import { computeTotals } from "../../domain/quotes/pricing";
import type { SupportedUnit } from "../../domain/shared/types";

const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

// Each template is a set of manual lines for one quote, matched to a project
// by a keyword found in the project name.
interface LineTemplate {
  name: string;
  unit: SupportedUnit;
  unitPrice: string;
  quantity: string;
  discountPct?: string;
}

const QUOTE_TEMPLATES: {
  match: string;
  discountPct: string;
  lines: LineTemplate[];
}[] = [
  {
    match: "baie",
    discountPct: "5",
    lines: [
      { name: "Demontare gresie și faianță existentă", unit: "m2", unitPrice: "90", quantity: "28" },
      { name: "Montaj faianță pereți", unit: "m2", unitPrice: "220", quantity: "22" },
      { name: "Montaj gresie pardoseală", unit: "m2", unitPrice: "210", quantity: "6" },
      { name: "Montaj obiecte sanitare", unit: "set", unitPrice: "1500", quantity: "1" },
      { name: "Instalație sanitară — refacere", unit: "service", unitPrice: "3200", quantity: "1" },
    ],
  },
  {
    match: "birou",
    discountPct: "0",
    lines: [
      { name: "Compartimentare gips-carton", unit: "m2", unitPrice: "280", quantity: "34" },
      { name: "Glet și șlefuire pereți", unit: "m2", unitPrice: "70", quantity: "120" },
      { name: "Vopsitorie lavabilă 2 straturi", unit: "m2", unitPrice: "55", quantity: "120" },
      { name: "Montaj pardoseală laminat", unit: "m2", unitPrice: "130", quantity: "48", discountPct: "10" },
    ],
  },
  {
    match: "acoperiș",
    discountPct: "0",
    lines: [
      { name: "Curățare și pregătire suport terasă", unit: "m2", unitPrice: "60", quantity: "40" },
      { name: "Hidroizolație membrană bituminoasă", unit: "m2", unitPrice: "180", quantity: "40" },
      { name: "Strat de protecție și finisaj", unit: "m2", unitPrice: "95", quantity: "40" },
    ],
  },
  {
    match: "dormitor",
    discountPct: "0",
    lines: [
      { name: "Izolație fonică pereți", unit: "m2", unitPrice: "160", quantity: "18" },
      { name: "Placare gips-carton", unit: "m2", unitPrice: "150", quantity: "18" },
      { name: "Montaj parchet stejar", unit: "m2", unitPrice: "260", quantity: "16" },
      { name: "Iluminat indirect LED", unit: "service", unitPrice: "1800", quantity: "1" },
    ],
  },
  {
    match: "electric",
    discountPct: "0",
    lines: [
      { name: "Tablou electric nou", unit: "pcs", unitPrice: "2200", quantity: "1" },
      { name: "Recablare completă apartament", unit: "service", unitPrice: "6500", quantity: "1" },
      { name: "Montaj prize și întrerupătoare", unit: "pcs", unitPrice: "45", quantity: "38" },
    ],
  },
];

async function main() {
  const orgs = await db.query.organizations.findMany({
    orderBy: [asc(schema.organizations.createdAt)],
    limit: 1,
  });
  if (orgs.length === 0) {
    console.error("No organization found. Sign up first, then run the seed.");
    process.exit(1);
  }
  const org = orgs[0]!;
  const currency = org.defaultCurrency;
  const vatRate = org.vatRate ?? "0";
  console.log(`Seeding quotes into: "${org.name}" (${org.id})`);

  const projects = await db.query.projects.findMany({
    where: eq(schema.projects.organizationId, org.id),
  });

  // Skip projects that already have at least one quote.
  const existing = await db
    .select({ projectId: schema.quotes.projectId })
    .from(schema.quotes)
    .where(eq(schema.quotes.organizationId, org.id));
  const projectsWithQuotes = new Set(
    existing.map((e) => e.projectId).filter(Boolean),
  );

  let created = 0;
  for (const template of QUOTE_TEMPLATES) {
    // Find a project matching the keyword that has no quotes yet.
    const project = projects.find(
      (p) =>
        p.name.toLowerCase().includes(template.match) &&
        !projectsWithQuotes.has(p.id),
    );
    if (!project) continue;
    projectsWithQuotes.add(project.id); // avoid reusing the same project

    // Look up the customer snapshot, if any.
    let customerName: string | null = null;
    let customerEmail: string | null = null;
    let customerPhone: string | null = null;
    if (project.customerId) {
      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, project.customerId))
        .limit(1);
      if (customer) {
        customerName = customer.name;
        customerEmail = customer.email;
        customerPhone = customer.phone;
      }
    }

    const totals = computeTotals({
      lines: template.lines.map((l) => ({
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        discountPct: l.discountPct ?? "0",
      })),
      quoteDiscountPct: template.discountPct,
      vatRate,
    });

    await db.transaction(async (tx) => {
      const [quote] = await tx
        .insert(schema.quotes)
        .values({ organizationId: org.id, projectId: project.id })
        .returning();

      const [version] = await tx
        .insert(schema.quoteVersions)
        .values({
          organizationId: org.id,
          quoteId: quote!.id,
          versionNumber: 1,
          status: "draft",
          currency,
          vatRate,
          discountPct: template.discountPct,
          customerName,
          customerEmail,
          customerPhone,
          projectName: project.name,
          projectAddress: project.address,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxableAmount: totals.taxableAmount,
          vatAmount: totals.vatAmount,
          total: totals.total,
        })
        .returning();

      await tx.insert(schema.quoteItems).values(
        template.lines.map((l, index) => ({
          organizationId: org.id,
          quoteVersionId: version!.id,
          sortOrder: index,
          name: l.name,
          unit: l.unit,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          discountPct: l.discountPct ?? "0",
          lineTotal: totals.lineTotals[index]!,
        })),
      );
    });

    created += 1;
    console.log(`✓ Deviz pentru "${project.name}" — total ${totals.total} ${currency}`);
  }

  console.log(`Seed complet: ${created} devize adăugate.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
