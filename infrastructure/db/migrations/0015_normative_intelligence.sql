ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "jurisdiction" text DEFAULT 'MD' NOT NULL;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "authority" text;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "approval_date" date;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "publication_date" date;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "effective_date" date;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "official_status" text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "monitoring_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "last_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "last_verification_status" text DEFAULT 'never' NOT NULL;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "last_verification_error" text;
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD COLUMN IF NOT EXISTS "content_fingerprint" text;
--> statement-breakpoint

ALTER TABLE "normative_sources" DROP CONSTRAINT IF EXISTS "normative_sources_type_check";
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD CONSTRAINT "normative_sources_type_check"
  CHECK ("normative_sources"."source_type" in ('normative_document', 'norm_collection', 'price_catalog', 'legislation', 'official_guidance', 'company_custom', 'import'));
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD CONSTRAINT "normative_sources_official_status_check"
  CHECK ("normative_sources"."official_status" in ('draft', 'consultation', 'approved', 'in_force', 'superseded', 'repealed', 'unknown'));
--> statement-breakpoint
ALTER TABLE "normative_sources" ADD CONSTRAINT "normative_sources_verification_status_check"
  CHECK ("normative_sources"."last_verification_status" in ('never', 'success', 'error'));
--> statement-breakpoint

ALTER TABLE "resource_prices" ADD COLUMN IF NOT EXISTS "source_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_prices" ADD CONSTRAINT "resource_prices_source_org_fkey"
 FOREIGN KEY ("source_id","organization_id")
 REFERENCES "public"."normative_sources"("id","organization_id")
 ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "normative_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "update_type" text DEFAULT 'source_page_changed' NOT NULL,
  "review_status" text DEFAULT 'detected' NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "impact_summary" text,
  "official_uri" text,
  "publication_date" date,
  "effective_date" date,
  "event_fingerprint" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "normative_updates_id_org_unique" UNIQUE("id","organization_id"),
  CONSTRAINT "normative_updates_source_event_unique" UNIQUE("organization_id","source_id","event_fingerprint"),
  CONSTRAINT "normative_updates_type_check" CHECK ("normative_updates"."update_type" in ('source_page_changed', 'amendment', 'replacement', 'status_change', 'price_catalog_update', 'other')),
  CONSTRAINT "normative_updates_review_status_check" CHECK ("normative_updates"."review_status" in ('detected', 'reviewed', 'dismissed'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_updates" ADD CONSTRAINT "normative_updates_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_updates" ADD CONSTRAINT "normative_updates_source_org_fkey"
 FOREIGN KEY ("source_id","organization_id")
 REFERENCES "public"."normative_sources"("id","organization_id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "normative_updates_org_detected_idx"
  ON "normative_updates" USING btree ("organization_id","detected_at");
