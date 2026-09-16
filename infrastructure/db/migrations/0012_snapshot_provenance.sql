ALTER TABLE "quote_versions" ADD COLUMN "snapshot_captured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "source_project_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "source_customer_id" uuid;--> statement-breakpoint

-- Existing finalized versions already contain frozen customer/project text.
-- Backfill only provenance we can know historically; do not invent a customer id.
DROP TRIGGER IF EXISTS quote_versions_immutability ON public.quote_versions;--> statement-breakpoint

UPDATE "quote_versions" AS qv
SET
  "snapshot_captured_at" = COALESCE(qv.sent_at, qv.updated_at, qv.created_at),
  "source_project_id" = q.project_id
FROM "quotes" AS q
WHERE qv.status <> 'draft'
  AND qv.quote_id = q.id
  AND qv.organization_id = q.organization_id;--> statement-breakpoint

ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_snapshot_provenance_check" CHECK ((
        ("quote_versions"."status" = 'draft'
          and "quote_versions"."snapshot_captured_at" is null
          and "quote_versions"."source_project_id" is null
          and "quote_versions"."source_customer_id" is null)
        or
        ("quote_versions"."status" <> 'draft'
          and "quote_versions"."snapshot_captured_at" is not null)
      ));--> statement-breakpoint

-- The backfill needs the trigger temporarily removed, but normal frozen-version
-- protection must be restored before the migration finishes.
DO $$
BEGIN
  IF to_regprocedure('public.enforce_quote_version_immutability()') IS NOT NULL THEN
    CREATE TRIGGER quote_versions_immutability
      BEFORE UPDATE OR DELETE ON public.quote_versions
      FOR EACH ROW EXECUTE FUNCTION public.enforce_quote_version_immutability();
  END IF;
END $$;
