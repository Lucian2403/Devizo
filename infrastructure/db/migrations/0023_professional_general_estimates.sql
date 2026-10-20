CREATE TABLE IF NOT EXISTS "professional_general_estimate_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"general_estimate_id" uuid NOT NULL,
	"object_estimate_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"chapter_position_number" integer NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_general_estimate_entries_membership_unique" UNIQUE("organization_id","general_estimate_id","object_estimate_id"),
	CONSTRAINT "professional_general_estimate_entries_chapter_position_unique" UNIQUE("organization_id","general_estimate_id","chapter_number","chapter_position_number"),
	CONSTRAINT "professional_general_estimate_entries_chapter_check" CHECK ("professional_general_estimate_entries"."chapter_number" between 1 and 12),
	CONSTRAINT "professional_general_estimate_entries_position_check" CHECK ("professional_general_estimate_entries"."chapter_position_number" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "professional_general_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"valuation_date" date NOT NULL,
	"currency" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_general_estimates_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "professional_general_estimates_currency_check" CHECK ("professional_general_estimates"."currency" in ('MDL', 'EUR', 'RON', 'USD', 'GBP')),
	CONSTRAINT "professional_general_estimates_name_check" CHECK (length(trim("professional_general_estimates"."name")) > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_estimate_entries" ADD CONSTRAINT "professional_general_estimate_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_estimate_entries" ADD CONSTRAINT "professional_general_estimate_entries_general_estimate_org_fkey" FOREIGN KEY ("general_estimate_id","organization_id") REFERENCES "public"."professional_general_estimates"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_estimate_entries" ADD CONSTRAINT "professional_general_estimate_entries_object_estimate_org_fkey" FOREIGN KEY ("object_estimate_id","organization_id") REFERENCES "public"."professional_object_estimates"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_estimates" ADD CONSTRAINT "professional_general_estimates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_general_estimate_entries_org_object_idx" ON "professional_general_estimate_entries" USING btree ("organization_id","object_estimate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_general_estimates_org_date_idx" ON "professional_general_estimates" USING btree ("organization_id","valuation_date");