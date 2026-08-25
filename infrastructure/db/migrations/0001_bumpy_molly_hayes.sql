CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"preferred_language" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "vat_rate" numeric(5, 2);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
