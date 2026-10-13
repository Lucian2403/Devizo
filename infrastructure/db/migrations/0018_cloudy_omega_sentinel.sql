ALTER TABLE "normative_applicability_decisions" ADD CONSTRAINT "normative_applicability_decisions_id_source_org_unique" UNIQUE("id","source_id","organization_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "professional_rule_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"applicability_decision_id" uuid,
	"name" text NOT NULL,
	"component" text NOT NULL,
	"value_type" text NOT NULL,
	"value" numeric(18, 6) NOT NULL,
	"currency" text,
	"calculation_basis" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"estimate_perspective" text NOT NULL,
	"work_kind" text NOT NULL,
	"rule_origin" text NOT NULL,
	"procurement_category" text,
	"source_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_rule_definitions_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "professional_rule_definitions_component_check" CHECK ("professional_rule_definitions"."component" in ('labor_contributions', 'material_transport', 'procurement_storage', 'overhead', 'estimated_profit')),
	CONSTRAINT "professional_rule_definitions_perspective_check" CHECK ("professional_rule_definitions"."estimate_perspective" in ('investor', 'contractor', 'any')),
	CONSTRAINT "professional_rule_definitions_work_kind_check" CHECK ("professional_rule_definitions"."work_kind" in ('construction', 'installation', 'commissioning', 'any')),
	CONSTRAINT "professional_rule_definitions_rule_origin_check" CHECK ("professional_rule_definitions"."rule_origin" in ('normative_sector_average', 'company_individual', 'contract_agreed', 'statutory')),
	CONSTRAINT "professional_rule_definitions_value_check" CHECK ("professional_rule_definitions"."value" >= 0),
	CONSTRAINT "professional_rule_definitions_validity_check" CHECK ("professional_rule_definitions"."valid_to" is null or "professional_rule_definitions"."valid_to" >= "professional_rule_definitions"."valid_from"),
	CONSTRAINT "professional_rule_definitions_semantics_check" CHECK ((
        ("professional_rule_definitions"."component" = 'labor_contributions' and "professional_rule_definitions"."value_type" = 'percent' and "professional_rule_definitions"."calculation_basis" = 'labor_cost')
        or ("professional_rule_definitions"."component" = 'material_transport' and "professional_rule_definitions"."value_type" = 'percent' and "professional_rule_definitions"."calculation_basis" = 'material_cost')
        or ("professional_rule_definitions"."component" = 'material_transport' and "professional_rule_definitions"."value_type" = 'fixed_amount' and "professional_rule_definitions"."calculation_basis" = 'fixed_amount')
        or ("professional_rule_definitions"."component" = 'procurement_storage' and "professional_rule_definitions"."value_type" = 'percent' and "professional_rule_definitions"."calculation_basis" = 'material_cost')
        or ("professional_rule_definitions"."component" = 'overhead' and "professional_rule_definitions"."value_type" = 'percent' and "professional_rule_definitions"."calculation_basis" in ('direct_cost', 'labor_cost'))
        or ("professional_rule_definitions"."component" = 'estimated_profit' and "professional_rule_definitions"."value_type" = 'percent' and "professional_rule_definitions"."calculation_basis" = 'estimate_cost_before_profit')
      )),
	CONSTRAINT "professional_rule_definitions_currency_check" CHECK (("professional_rule_definitions"."value_type" = 'fixed_amount' and "professional_rule_definitions"."currency" is not null and "professional_rule_definitions"."currency" in ('MDL', 'EUR', 'RON', 'USD', 'GBP'))
        or ("professional_rule_definitions"."value_type" <> 'fixed_amount' and "professional_rule_definitions"."currency" is null)),
	CONSTRAINT "professional_rule_definitions_procurement_category_check" CHECK (("professional_rule_definitions"."component" = 'procurement_storage' and "professional_rule_definitions"."procurement_category" is not null and length(trim("professional_rule_definitions"."procurement_category")) > 0)
        or ("professional_rule_definitions"."component" <> 'procurement_storage' and "professional_rule_definitions"."procurement_category" is null)),
	CONSTRAINT "professional_rule_definitions_official_decision_check" CHECK ("professional_rule_definitions"."rule_origin" not in ('normative_sector_average', 'statutory')
        or "professional_rule_definitions"."applicability_decision_id" is not null),
	CONSTRAINT "professional_rule_definitions_source_reference_check" CHECK ("professional_rule_definitions"."source_reference" is null or length(trim("professional_rule_definitions"."source_reference")) > 0),
	CONSTRAINT "professional_rule_definitions_name_check" CHECK (length(trim("professional_rule_definitions"."name")) > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_rule_definitions" ADD CONSTRAINT "professional_rule_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_rule_definitions" ADD CONSTRAINT "professional_rule_definitions_source_org_fkey" FOREIGN KEY ("source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_rule_definitions" ADD CONSTRAINT "professional_rule_definitions_applicability_source_org_fkey" FOREIGN KEY ("applicability_decision_id","source_id","organization_id") REFERENCES "public"."normative_applicability_decisions"("id","source_id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_rule_definitions_org_component_idx" ON "professional_rule_definitions" USING btree ("organization_id","component");