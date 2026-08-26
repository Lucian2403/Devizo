CREATE TABLE IF NOT EXISTS "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"project_name" text,
	"project_address" text,
	"notes" text,
	"validity_days" integer,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_versions_quote_version_unique" UNIQUE("quote_id","version_number"),
	CONSTRAINT "quote_versions_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "quote_versions_status_check" CHECK ("quote_versions"."status" in ('draft', 'sent', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"catalog_item_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_items_unit_check" CHECK ("quote_items"."unit" in ('m2', 'm', 'm3', 'pcs', 'hour', 'day', 'kg', 'l', 'set', 'service'))
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_id_org_unique" UNIQUE("id","organization_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_org_fkey" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_org_fkey" FOREIGN KEY ("quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_version_org_fkey" FOREIGN KEY ("quote_version_id","organization_id") REFERENCES "public"."quote_versions"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;