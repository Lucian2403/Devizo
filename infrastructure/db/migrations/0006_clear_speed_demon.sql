CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalog_match_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"extracted_text" text NOT NULL,
	"suggested_catalog_item_id" uuid,
	"selected_catalog_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "embedding_source" text;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "embedding_updated_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalog_match_feedback" ADD CONSTRAINT "catalog_match_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalog_match_feedback" ADD CONSTRAINT "catalog_match_feedback_suggested_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("suggested_catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalog_match_feedback" ADD CONSTRAINT "catalog_match_feedback_selected_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("selected_catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_match_feedback_org_created_idx" ON "catalog_match_feedback" USING btree ("organization_id","created_at");