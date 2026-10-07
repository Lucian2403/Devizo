CREATE TABLE IF NOT EXISTS "normative_applicability_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"triggering_update_id" uuid,
	"revision" integer NOT NULL,
	"decision" text NOT NULL,
	"applicable_from" date,
	"applicable_until" date,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_user_id" uuid NOT NULL,
	"basis_note" text NOT NULL,
	"evidence_uri" text,
	"source_code" text NOT NULL,
	"source_edition" text NOT NULL,
	"source_authority" text,
	"source_uri" text,
	"source_fingerprint" text,
	"official_status" text NOT NULL,
	CONSTRAINT "normative_applicability_decisions_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "normative_applicability_source_revision_unique" UNIQUE("organization_id","source_id","revision"),
	CONSTRAINT "normative_applicability_revision_check" CHECK ("normative_applicability_decisions"."revision" > 0),
	CONSTRAINT "normative_applicability_decision_check" CHECK ("normative_applicability_decisions"."decision" in ('applicable', 'not_applicable', 'deferred', 'unknown')),
	CONSTRAINT "normative_applicability_applicable_date_check" CHECK ("normative_applicability_decisions"."decision" <> 'applicable' or ("normative_applicability_decisions"."applicable_from" is not null and "normative_applicability_decisions"."official_status" = 'in_force')),
	CONSTRAINT "normative_applicability_validity_check" CHECK ("normative_applicability_decisions"."applicable_until" is null or "normative_applicability_decisions"."applicable_from" is null or "normative_applicability_decisions"."applicable_until" >= "normative_applicability_decisions"."applicable_from"),
	CONSTRAINT "normative_applicability_basis_note_check" CHECK (length(trim("normative_applicability_decisions"."basis_note")) between 1 and 4000),
	CONSTRAINT "normative_applicability_evidence_uri_check" CHECK ("normative_applicability_decisions"."evidence_uri" is null or length(trim("normative_applicability_decisions"."evidence_uri")) <= 2048)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "normative_source_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_source_id" uuid NOT NULL,
	"to_source_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"effective_date" date,
	"evidence_uri" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	CONSTRAINT "normative_source_relations_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "normative_source_relations_unique" UNIQUE("organization_id","from_source_id","to_source_id","relation_type"),
	CONSTRAINT "normative_source_relations_not_self_check" CHECK ("normative_source_relations"."from_source_id" <> "normative_source_relations"."to_source_id"),
	CONSTRAINT "normative_source_relations_type_check" CHECK ("normative_source_relations"."relation_type" in ('amends', 'replaces', 'supersedes', 'supplements', 'corrigendum_to', 'related_to')),
	CONSTRAINT "normative_source_relations_evidence_uri_check" CHECK ("normative_source_relations"."evidence_uri" is null or length(trim("normative_source_relations"."evidence_uri")) <= 2048),
	CONSTRAINT "normative_source_relations_note_check" CHECK ("normative_source_relations"."note" is null or length(trim("normative_source_relations"."note")) <= 4000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "normative_update_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"update_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"source_code" text NOT NULL,
	"source_edition" text NOT NULL,
	"source_authority" text,
	"official_uri" text,
	"publication_date" date,
	"effective_date" date,
	"previous_fingerprint" text,
	"detected_fingerprint" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "normative_update_reviews_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "normative_update_reviews_update_unique" UNIQUE("update_id"),
	CONSTRAINT "normative_update_reviews_decision_check" CHECK ("normative_update_reviews"."decision" in ('reviewed_no_action', 'dismissed', 'requires_normative_version', 'requires_metadata_update', 'requires_follow_up')),
	CONSTRAINT "normative_update_reviews_note_length_check" CHECK ("normative_update_reviews"."note" is null or length(trim("normative_update_reviews"."note")) <= 4000)
);
--> statement-breakpoint
ALTER TABLE "estimate_norm_versions" DROP CONSTRAINT "estimate_norm_versions_norm_org_fkey";
--> statement-breakpoint
ALTER TABLE "resource_consumptions" DROP CONSTRAINT "resource_consumptions_norm_version_org_fkey";
--> statement-breakpoint
ALTER TABLE "resource_prices" DROP CONSTRAINT "resource_prices_resource_org_fkey";
--> statement-breakpoint
ALTER TABLE "normative_updates" DROP CONSTRAINT "normative_updates_source_org_fkey";
--> statement-breakpoint
ALTER TABLE "estimate_norm_versions" ADD COLUMN "publication_status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_applicability_decisions" ADD CONSTRAINT "normative_applicability_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_applicability_decisions" ADD CONSTRAINT "normative_applicability_source_org_fkey" FOREIGN KEY ("source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_applicability_decisions" ADD CONSTRAINT "normative_applicability_update_org_fkey" FOREIGN KEY ("triggering_update_id","organization_id") REFERENCES "public"."normative_updates"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_applicability_decisions" ADD CONSTRAINT "normative_applicability_decider_org_fkey" FOREIGN KEY ("organization_id","decided_by_user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_source_relations" ADD CONSTRAINT "normative_source_relations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_source_relations" ADD CONSTRAINT "normative_source_relations_from_source_org_fkey" FOREIGN KEY ("from_source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_source_relations" ADD CONSTRAINT "normative_source_relations_to_source_org_fkey" FOREIGN KEY ("to_source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_source_relations" ADD CONSTRAINT "normative_source_relations_creator_org_fkey" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_update_reviews" ADD CONSTRAINT "normative_update_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_update_reviews" ADD CONSTRAINT "normative_update_reviews_update_org_fkey" FOREIGN KEY ("update_id","organization_id") REFERENCES "public"."normative_updates"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_update_reviews" ADD CONSTRAINT "normative_update_reviews_source_org_fkey" FOREIGN KEY ("source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_update_reviews" ADD CONSTRAINT "normative_update_reviews_reviewer_org_fkey" FOREIGN KEY ("organization_id","reviewer_user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "normative_source_relations_org_created_idx" ON "normative_source_relations" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "normative_update_reviews_org_reviewed_idx" ON "normative_update_reviews" USING btree ("organization_id","reviewed_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "estimate_norm_versions" ADD CONSTRAINT "estimate_norm_versions_norm_org_fkey" FOREIGN KEY ("estimate_norm_id","organization_id") REFERENCES "public"."estimate_norms"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_consumptions" ADD CONSTRAINT "resource_consumptions_norm_version_org_fkey" FOREIGN KEY ("estimate_norm_version_id","organization_id") REFERENCES "public"."estimate_norm_versions"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_prices" ADD CONSTRAINT "resource_prices_resource_org_fkey" FOREIGN KEY ("resource_id","organization_id") REFERENCES "public"."professional_resources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_updates" ADD CONSTRAINT "normative_updates_source_org_fkey" FOREIGN KEY ("source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "estimate_norm_versions" ADD CONSTRAINT "estimate_norm_versions_publication_status_check" CHECK ("estimate_norm_versions"."publication_status" in ('draft', 'in_review', 'approved', 'published'));