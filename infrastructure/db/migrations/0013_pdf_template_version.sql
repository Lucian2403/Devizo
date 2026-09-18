ALTER TABLE "quote_versions" ADD COLUMN "pdf_template_version" text;--> statement-breakpoint

-- Existing finalized commercial documents were issued with the layout that now
-- becomes commercial-offer-v1. Drafts remain unversioned until finalization.
DROP TRIGGER IF EXISTS quote_versions_immutability ON public.quote_versions;--> statement-breakpoint

UPDATE "quote_versions"
SET "pdf_template_version" = 'commercial-offer-v1'
WHERE "status" <> 'draft';--> statement-breakpoint

ALTER TABLE "quote_versions"
  ADD CONSTRAINT "quote_versions_pdf_template_version_check"
  CHECK ((
    ("quote_versions"."status" = 'draft'
      and "quote_versions"."pdf_template_version" is null)
    or
    ("quote_versions"."status" <> 'draft'
      and "quote_versions"."pdf_template_version" = 'commercial-offer-v1')
  ));--> statement-breakpoint

-- Restore the existing database immutability guard when policies are already
-- installed. On a fresh database the policy script may be applied afterwards.
DO $$
BEGIN
  IF to_regprocedure('public.enforce_quote_version_immutability()') IS NOT NULL THEN
    CREATE TRIGGER quote_versions_immutability
      BEFORE UPDATE OR DELETE ON public.quote_versions
      FOR EACH ROW EXECUTE FUNCTION public.enforce_quote_version_immutability();
  END IF;
END $$;
