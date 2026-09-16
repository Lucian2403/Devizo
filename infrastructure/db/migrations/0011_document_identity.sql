ALTER TABLE "quote_versions" ADD COLUMN "document_number" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "document_year" integer;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "document_sequence" integer;--> statement-breakpoint

-- Older installations may already have the M7.2 immutability trigger. The
-- backfill is the one controlled exception: it enriches frozen rows with their
-- missing identity, then the trigger is restored below.
DROP TRIGGER IF EXISTS quote_versions_immutability ON public.quote_versions;--> statement-breakpoint

-- Existing finalized versions already displayed a deterministic number derived
-- from quote UUID + year + version. Preserve that customer-facing number instead
-- of silently renumbering historical PDFs. document_sequence is new bookkeeping
-- used only to allocate future numbers safely within each organization/year.
WITH source_rows AS (
  SELECT
    id,
    organization_id,
    version_number,
    COALESCE(sent_at, created_at) AS identity_date,
    EXTRACT(YEAR FROM (COALESCE(sent_at, created_at) AT TIME ZONE 'UTC'))::integer AS document_year,
    decode(substr(replace(quote_id::text, '-', ''), 1, 8), 'hex') AS quote_seed_bytes
  FROM "quote_versions"
  WHERE status <> 'draft'
),
prepared AS (
  SELECT
    id,
    organization_id,
    version_number,
    identity_date,
    document_year,
    (
      get_byte(quote_seed_bytes, 0)::bigint * 16777216 +
      get_byte(quote_seed_bytes, 1)::bigint * 65536 +
      get_byte(quote_seed_bytes, 2)::bigint * 256 +
      get_byte(quote_seed_bytes, 3)::bigint
    ) AS quote_seed,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, document_year
      ORDER BY identity_date, id
    )::integer AS document_sequence
  FROM source_rows
),
legacy_numbers AS (
  SELECT
    *,
    'DEV-' || document_year::text || '-' ||
      LPAD((((quote_seed % 1000) + 1)::integer)::text, 3, '0') ||
      ' / v' || version_number::text AS legacy_document_number
  FROM prepared
),
deduplicated AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, legacy_document_number
      ORDER BY identity_date, id
    ) AS number_occurrence
  FROM legacy_numbers
)
UPDATE "quote_versions" AS qv
SET
  "document_year" = deduplicated.document_year,
  "document_sequence" = deduplicated.document_sequence,
  "document_number" = CASE
    WHEN deduplicated.number_occurrence = 1 THEN deduplicated.legacy_document_number
    ELSE deduplicated.legacy_document_number || '-legacy-' || substr(deduplicated.id::text, 1, 8)
  END
FROM deduplicated
WHERE qv.id = deduplicated.id;--> statement-breakpoint

ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_org_document_number_unique" UNIQUE("organization_id","document_number");--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_org_document_sequence_unique" UNIQUE("organization_id","document_year","document_sequence");--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_document_identity_check" CHECK ((
        ("quote_versions"."status" = 'draft'
          and "quote_versions"."document_number" is null
          and "quote_versions"."document_year" is null
          and "quote_versions"."document_sequence" is null)
        or
        ("quote_versions"."status" <> 'draft'
          and "quote_versions"."document_number" is not null
          and "quote_versions"."document_year" is not null
          and "quote_versions"."document_sequence" is not null
          and "quote_versions"."document_sequence" > 0)
      ));--> statement-breakpoint

-- Recreate the existing immutability trigger when its policy function is
-- already installed. On a fresh database db:policies will create it afterwards.
DO $$
BEGIN
  IF to_regprocedure('public.enforce_quote_version_immutability()') IS NOT NULL THEN
    CREATE TRIGGER quote_versions_immutability
      BEFORE UPDATE OR DELETE ON public.quote_versions
      FOR EACH ROW EXECUTE FUNCTION public.enforce_quote_version_immutability();
  END IF;
END $$;