CREATE TABLE IF NOT EXISTS "professional_object_estimate_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"object_estimate_id" uuid NOT NULL,
	"calculation_context_id" uuid NOT NULL,
	"position_number" integer NOT NULL,
	"cost_category" text NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_object_estimate_entries_membership_unique" UNIQUE("organization_id","object_estimate_id","calculation_context_id"),
	CONSTRAINT "professional_object_estimate_entries_position_unique" UNIQUE("organization_id","object_estimate_id","position_number"),
	CONSTRAINT "professional_object_estimate_entries_position_check" CHECK ("professional_object_estimate_entries"."position_number" > 0),
	CONSTRAINT "professional_object_estimate_entries_cost_category_check" CHECK ("professional_object_estimate_entries"."cost_category" in ('construction_works', 'installation_works', 'equipment_furniture_inventory', 'other_costs'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "professional_object_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"construction_object_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"valuation_date" date NOT NULL,
	"currency" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_object_estimates_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "professional_object_estimates_currency_check" CHECK ("professional_object_estimates"."currency" in ('MDL', 'EUR', 'RON', 'USD', 'GBP')),
	CONSTRAINT "professional_object_estimates_name_check" CHECK (length(trim("professional_object_estimates"."name")) > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_object_estimate_entries" ADD CONSTRAINT "professional_object_estimate_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_object_estimate_entries" ADD CONSTRAINT "professional_object_estimate_entries_object_estimate_org_fkey" FOREIGN KEY ("object_estimate_id","organization_id") REFERENCES "public"."professional_object_estimates"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_object_estimate_entries" ADD CONSTRAINT "professional_object_estimate_entries_context_org_fkey" FOREIGN KEY ("calculation_context_id","organization_id") REFERENCES "public"."calculation_contexts"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_object_estimates" ADD CONSTRAINT "professional_object_estimates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_object_estimates" ADD CONSTRAINT "professional_object_estimates_object_org_fkey" FOREIGN KEY ("construction_object_id","organization_id") REFERENCES "public"."construction_objects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_object_estimate_entries_org_context_idx" ON "professional_object_estimate_entries" USING btree ("organization_id","calculation_context_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_object_estimates_org_object_idx" ON "professional_object_estimates" USING btree ("organization_id","construction_object_id");