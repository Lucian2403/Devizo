CREATE TABLE IF NOT EXISTS "calculation_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"construction_object_id" uuid NOT NULL,
	"work_quantity_list_id" uuid NOT NULL,
	"name" text NOT NULL,
	"valuation_date" date NOT NULL,
	"currency" text NOT NULL,
	"region" text,
	"method" text DEFAULT 'resource' NOT NULL,
	"normative_basis" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calculation_contexts_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "calculation_contexts_id_list_org_unique" UNIQUE("id","work_quantity_list_id","organization_id"),
	CONSTRAINT "calculation_contexts_currency_check" CHECK ("calculation_contexts"."currency" in ('MDL', 'EUR', 'RON', 'USD', 'GBP')),
	CONSTRAINT "calculation_contexts_method_check" CHECK ("calculation_contexts"."method" = 'resource')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calculation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"calculation_context_id" uuid NOT NULL,
	"norm_application_id" uuid,
	"source_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rule_type" text NOT NULL,
	"basis" text NOT NULL,
	"value_type" text NOT NULL,
	"value" numeric(18, 6) NOT NULL,
	"currency" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calculation_rules_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "calculation_rules_type_check" CHECK ("calculation_rules"."rule_type" in ('coefficient', 'overhead', 'estimated_profit', 'transport', 'procurement_storage', 'temporary_works', 'winter_conditions', 'other')),
	CONSTRAINT "calculation_rules_basis_check" CHECK ("calculation_rules"."basis" in ('direct_cost', 'labor_cost', 'material_cost', 'machinery_cost', 'wages', 'resource_cost', 'custom')),
	CONSTRAINT "calculation_rules_value_type_check" CHECK ("calculation_rules"."value_type" in ('percent', 'coefficient', 'fixed_amount')),
	CONSTRAINT "calculation_rules_value_check" CHECK ("calculation_rules"."value" >= 0),
	CONSTRAINT "calculation_rules_fixed_currency_check" CHECK (("calculation_rules"."value_type" = 'fixed_amount' and "calculation_rules"."currency" is not null)
        or ("calculation_rules"."value_type" <> 'fixed_amount' and "calculation_rules"."currency" is null)),
	CONSTRAINT "calculation_rules_currency_check" CHECK ("calculation_rules"."currency" is null or "calculation_rules"."currency" in ('MDL', 'EUR', 'RON', 'USD', 'GBP'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "construction_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"code" text,
	"name" text NOT NULL,
	"address" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "construction_objects_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "estimate_norm_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estimate_norm_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"method" text DEFAULT 'resource' NOT NULL,
	"basis_quantity" numeric(18, 6) DEFAULT '1' NOT NULL,
	"basis_unit" text NOT NULL,
	"description" text,
	"valid_from" date,
	"valid_to" date,
	"applicability" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_norm_versions_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "estimate_norm_versions_norm_version_unique" UNIQUE("estimate_norm_id","version_label"),
	CONSTRAINT "estimate_norm_versions_method_check" CHECK ("estimate_norm_versions"."method" = 'resource'),
	CONSTRAINT "estimate_norm_versions_basis_quantity_check" CHECK ("estimate_norm_versions"."basis_quantity" > 0),
	CONSTRAINT "estimate_norm_versions_basis_unit_nonempty_check" CHECK (length(trim("estimate_norm_versions"."basis_unit")) > 0),
	CONSTRAINT "estimate_norm_versions_validity_check" CHECK ("estimate_norm_versions"."valid_to" is null or "estimate_norm_versions"."valid_from" is null or "estimate_norm_versions"."valid_to" >= "estimate_norm_versions"."valid_from")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "estimate_norms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_norms_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "estimate_norms_org_namespace_code_unique" UNIQUE("organization_id","namespace","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "norm_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"calculation_context_id" uuid NOT NULL,
	"work_quantity_list_id" uuid NOT NULL,
	"work_quantity_item_id" uuid NOT NULL,
	"estimate_norm_version_id" uuid NOT NULL,
	"application_order" integer DEFAULT 1 NOT NULL,
	"application_coefficient" numeric(18, 6) DEFAULT '1' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "norm_applications_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "norm_applications_id_context_org_unique" UNIQUE("id","calculation_context_id","organization_id"),
	CONSTRAINT "norm_applications_context_item_order_unique" UNIQUE("calculation_context_id","work_quantity_item_id","application_order"),
	CONSTRAINT "norm_applications_order_check" CHECK ("norm_applications"."application_order" > 0),
	CONSTRAINT "norm_applications_coefficient_check" CHECK ("norm_applications"."application_coefficient" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "normative_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"edition" text NOT NULL,
	"source_type" text NOT NULL,
	"publisher" text,
	"source_uri" text,
	"valid_from" date,
	"valid_to" date,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "normative_sources_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "normative_sources_org_code_edition_unique" UNIQUE("organization_id","code","edition"),
	CONSTRAINT "normative_sources_type_check" CHECK ("normative_sources"."source_type" in ('normative_document', 'norm_collection', 'company_custom', 'import')),
	CONSTRAINT "normative_sources_status_check" CHECK ("normative_sources"."status" in ('draft', 'active', 'superseded')),
	CONSTRAINT "normative_sources_validity_check" CHECK ("normative_sources"."valid_to" is null or "normative_sources"."valid_from" is null or "normative_sources"."valid_to" >= "normative_sources"."valid_from")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "professional_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"resource_type" text NOT NULL,
	"unit" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_resources_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "professional_resources_type_check" CHECK ("professional_resources"."resource_type" in ('labor', 'material', 'machinery', 'transport', 'energy', 'other')),
	CONSTRAINT "professional_resources_unit_nonempty_check" CHECK (length(trim("professional_resources"."unit")) > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_consumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estimate_norm_version_id" uuid NOT NULL,
	"position_number" integer NOT NULL,
	"resource_id" uuid NOT NULL,
	"quantity_per_norm_basis" numeric(18, 6) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_consumptions_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "resource_consumptions_norm_position_unique" UNIQUE("estimate_norm_version_id","position_number"),
	CONSTRAINT "resource_consumptions_position_check" CHECK ("resource_consumptions"."position_number" > 0),
	CONSTRAINT "resource_consumptions_quantity_check" CHECK ("resource_consumptions"."quantity_per_norm_basis" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"price" numeric(18, 6) NOT NULL,
	"basis_quantity" numeric(18, 6) DEFAULT '1' NOT NULL,
	"currency" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_reference" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_prices_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "resource_prices_price_check" CHECK ("resource_prices"."price" >= 0),
	CONSTRAINT "resource_prices_basis_quantity_check" CHECK ("resource_prices"."basis_quantity" > 0),
	CONSTRAINT "resource_prices_currency_check" CHECK ("resource_prices"."currency" in ('MDL', 'EUR', 'RON', 'USD', 'GBP')),
	CONSTRAINT "resource_prices_source_type_check" CHECK ("resource_prices"."source_type" in ('manual', 'supplier', 'invoice', 'market', 'import')),
	CONSTRAINT "resource_prices_validity_check" CHECK ("resource_prices"."valid_to" is null or "resource_prices"."valid_to" >= "resource_prices"."valid_from")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_quantity_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"work_quantity_list_id" uuid NOT NULL,
	"position_number" integer NOT NULL,
	"code" text,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_quantity_items_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "work_quantity_items_id_list_org_unique" UNIQUE("id","work_quantity_list_id","organization_id"),
	CONSTRAINT "work_quantity_items_list_position_unique" UNIQUE("work_quantity_list_id","position_number"),
	CONSTRAINT "work_quantity_items_position_check" CHECK ("work_quantity_items"."position_number" > 0),
	CONSTRAINT "work_quantity_items_quantity_check" CHECK ("work_quantity_items"."quantity" > 0),
	CONSTRAINT "work_quantity_items_unit_nonempty_check" CHECK (length(trim("work_quantity_items"."unit")) > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_quantity_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"construction_object_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"source_reference" text,
	"source_date" date,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_quantity_lists_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "work_quantity_lists_id_object_org_unique" UNIQUE("id","construction_object_id","organization_id"),
	CONSTRAINT "work_quantity_lists_revision_check" CHECK ("work_quantity_lists"."revision" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calculation_contexts" ADD CONSTRAINT "calculation_contexts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calculation_contexts" ADD CONSTRAINT "calculation_contexts_object_org_fkey" FOREIGN KEY ("construction_object_id","organization_id") REFERENCES "public"."construction_objects"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calculation_contexts" ADD CONSTRAINT "calculation_contexts_list_object_org_fkey" FOREIGN KEY ("work_quantity_list_id","construction_object_id","organization_id") REFERENCES "public"."work_quantity_lists"("id","construction_object_id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calculation_rules" ADD CONSTRAINT "calculation_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calculation_rules" ADD CONSTRAINT "calculation_rules_context_org_fkey" FOREIGN KEY ("calculation_context_id","organization_id") REFERENCES "public"."calculation_contexts"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calculation_rules" ADD CONSTRAINT "calculation_rules_source_org_fkey" FOREIGN KEY ("source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calculation_rules" ADD CONSTRAINT "calculation_rules_norm_application_context_org_fkey" FOREIGN KEY ("norm_application_id","calculation_context_id","organization_id") REFERENCES "public"."norm_applications"("id","calculation_context_id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "construction_objects" ADD CONSTRAINT "construction_objects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "construction_objects" ADD CONSTRAINT "construction_objects_project_org_fkey" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "estimate_norm_versions" ADD CONSTRAINT "estimate_norm_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "estimate_norm_versions" ADD CONSTRAINT "estimate_norm_versions_norm_org_fkey" FOREIGN KEY ("estimate_norm_id","organization_id") REFERENCES "public"."estimate_norms"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "estimate_norm_versions" ADD CONSTRAINT "estimate_norm_versions_source_org_fkey" FOREIGN KEY ("source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "estimate_norms" ADD CONSTRAINT "estimate_norms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "norm_applications" ADD CONSTRAINT "norm_applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "norm_applications" ADD CONSTRAINT "norm_applications_context_list_org_fkey" FOREIGN KEY ("calculation_context_id","work_quantity_list_id","organization_id") REFERENCES "public"."calculation_contexts"("id","work_quantity_list_id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "norm_applications" ADD CONSTRAINT "norm_applications_work_item_list_org_fkey" FOREIGN KEY ("work_quantity_item_id","work_quantity_list_id","organization_id") REFERENCES "public"."work_quantity_items"("id","work_quantity_list_id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "norm_applications" ADD CONSTRAINT "norm_applications_norm_version_org_fkey" FOREIGN KEY ("estimate_norm_version_id","organization_id") REFERENCES "public"."estimate_norm_versions"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "normative_sources" ADD CONSTRAINT "normative_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_resources" ADD CONSTRAINT "professional_resources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_resources" ADD CONSTRAINT "professional_resources_source_org_fkey" FOREIGN KEY ("source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_consumptions" ADD CONSTRAINT "resource_consumptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_consumptions" ADD CONSTRAINT "resource_consumptions_norm_version_org_fkey" FOREIGN KEY ("estimate_norm_version_id","organization_id") REFERENCES "public"."estimate_norm_versions"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_consumptions" ADD CONSTRAINT "resource_consumptions_resource_org_fkey" FOREIGN KEY ("resource_id","organization_id") REFERENCES "public"."professional_resources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_prices" ADD CONSTRAINT "resource_prices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_prices" ADD CONSTRAINT "resource_prices_resource_org_fkey" FOREIGN KEY ("resource_id","organization_id") REFERENCES "public"."professional_resources"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_quantity_items" ADD CONSTRAINT "work_quantity_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_quantity_items" ADD CONSTRAINT "work_quantity_items_list_org_fkey" FOREIGN KEY ("work_quantity_list_id","organization_id") REFERENCES "public"."work_quantity_lists"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_quantity_lists" ADD CONSTRAINT "work_quantity_lists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_quantity_lists" ADD CONSTRAINT "work_quantity_lists_object_org_fkey" FOREIGN KEY ("construction_object_id","organization_id") REFERENCES "public"."construction_objects"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "construction_objects_org_code_unique" ON "construction_objects" USING btree ("organization_id","code") WHERE "construction_objects"."code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "professional_resources_org_source_code_unique" ON "professional_resources" USING btree ("organization_id","source_id","code") WHERE "professional_resources"."code" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_prices_resource_valid_from_idx" ON "resource_prices" USING btree ("resource_id","valid_from");