/**
 * ONE-TIME DEV BACKFILL — NOT part of PDF generation.
 *
 * Older dev/test quote versions were finalized ('sent') before the company/
 * document snapshot fields existed, so their snapshot columns are NULL and the
 * PDF renders an empty company header. This script fills those NULLs from the
 * CURRENT organization settings. It is a deliberate developer action, never run
 * automatically, and only touches rows whose company_name is still NULL.
 *
 * It temporarily disables the immutability trigger (frozen versions normally
 * reject UPDATE) and re-enables it afterwards. Run only against dev data:
 *
 *   npx --yes pnpm@9.12.0 tsx scripts/backfill-quote-snapshots.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1 });

  const targets = await sql`
    select id, organization_id
    from quote_versions
    where status <> 'draft' and company_name is null
  `;

  if (targets.length === 0) {
    console.log("No sent versions need backfilling.");
    await sql.end();
    return;
  }

  console.log(`Backfilling ${targets.length} finalized version(s)...`);

  await sql`alter table quote_versions disable trigger quote_versions_immutability`;
  try {
    await sql`
      update quote_versions v
      set
        company_name = o.name,
        company_legal_name = o.legal_name,
        company_tax_vat_id = o.vat_number,
        company_email = o.email,
        company_phone = o.phone,
        company_address = o.address,
        company_country = o.country,
        document_language = coalesce(v.document_language, o.customer_document_language),
        payment_terms = coalesce(v.payment_terms, o.payment_terms),
        execution_duration = coalesce(v.execution_duration, o.execution_duration),
        inclusions = coalesce(v.inclusions, o.inclusions),
        exclusions = coalesce(v.exclusions, o.exclusions),
        company_terms = coalesce(v.company_terms, o.legal_terms),
        sent_at = coalesce(v.sent_at, v.updated_at),
        valid_until = case
          when v.valid_until is not null then v.valid_until
          when v.validity_days is not null and v.validity_days > 0
            then coalesce(v.sent_at, v.updated_at) + (v.validity_days || ' days')::interval
          else null
        end
      from organizations o
      where v.organization_id = o.id
        and v.status <> 'draft'
        and v.company_name is null
    `;
  } finally {
    await sql`alter table quote_versions enable trigger quote_versions_immutability`;
  }

  console.log("Backfill complete.");
  await sql.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
