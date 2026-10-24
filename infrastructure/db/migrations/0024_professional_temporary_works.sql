CREATE TABLE IF NOT EXISTS "professional_general_rule_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "applicability_decision_id" uuid NOT NULL,
  "component" text NOT NULL,
  "rule_code" text NOT NULL,
  "group_code" text NOT NULL,
  "group_label" text NOT NULL,
  "name" text NOT NULL,
  "value_type" text NOT NULL,
  "value" numeric(18, 6) NOT NULL,
  "valid_from" date NOT NULL,
  "valid_to" date,
  "source_reference" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "professional_general_rules_id_org_unique" UNIQUE("id","organization_id"),
  CONSTRAINT "professional_general_rules_id_org_component_unique" UNIQUE("id","organization_id","component"),
  CONSTRAINT "professional_general_rules_pack_slot_unique" UNIQUE("organization_id","source_id","applicability_decision_id","component","rule_code"),
  CONSTRAINT "professional_general_rules_component_check" CHECK ("component" = 'temporary_works'),
  CONSTRAINT "professional_general_rules_value_type_check" CHECK ("value_type" = 'percent'),
  CONSTRAINT "professional_general_rules_value_check" CHECK ("value" > 0),
  CONSTRAINT "professional_general_rules_validity_check" CHECK ("valid_to" is null or "valid_to" >= "valid_from"),
  CONSTRAINT "professional_general_rules_text_check" CHECK (
    length(trim("rule_code")) > 0
    and length(trim("group_code")) > 0
    and length(trim("group_label")) > 0
    and length(trim("name")) > 0
    and length(trim("source_reference")) > 0
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "professional_general_cost_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "general_estimate_id" uuid NOT NULL,
  "component" text NOT NULL,
  "mode" text NOT NULL,
  "rule_definition_id" uuid,
  "project_condition" text,
  "project_construction_amount" numeric(18, 6),
  "project_installation_amount" numeric(18, 6),
  "project_reference" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "professional_general_cost_decisions_estimate_component_unique" UNIQUE("organization_id","general_estimate_id","component"),
  CONSTRAINT "professional_general_cost_decisions_id_org_unique" UNIQUE("id","organization_id"),
  CONSTRAINT "professional_general_cost_decisions_component_check" CHECK ("component" = 'temporary_works'),
  CONSTRAINT "professional_general_cost_decisions_mode_check" CHECK ("mode" in ('normative_rate', 'project_calculation')),
  CONSTRAINT "professional_general_cost_decisions_shape_check" CHECK (
    (
      "mode" = 'normative_rate'
      and "rule_definition_id" is not null
      and "project_condition" in (
        'standard',
        'reconstruction_or_extension_operating_facility',
        'road_reconstruction',
        'capital_repair_complex',
        'capital_repair_selective'
      )
      and "project_construction_amount" is null
      and "project_installation_amount" is null
      and "project_reference" is null
    )
    or
    (
      "mode" = 'project_calculation'
      and "rule_definition_id" is null
      and "project_condition" is null
      and "project_construction_amount" is not null
      and "project_installation_amount" is not null
      and "project_construction_amount" >= 0
      and "project_installation_amount" >= 0
      and ("project_construction_amount" + "project_installation_amount") > 0
      and "project_reference" is not null
      and length(trim("project_reference")) > 0
    )
  )
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_rule_definitions" ADD CONSTRAINT "professional_general_rule_definitions_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_rule_definitions" ADD CONSTRAINT "professional_general_rules_source_org_fkey"
 FOREIGN KEY ("source_id","organization_id") REFERENCES "public"."normative_sources"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_rule_definitions" ADD CONSTRAINT "professional_general_rules_applicability_source_org_fkey"
 FOREIGN KEY ("applicability_decision_id","source_id","organization_id")
 REFERENCES "public"."normative_applicability_decisions"("id","source_id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_cost_decisions" ADD CONSTRAINT "professional_general_cost_decisions_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_cost_decisions" ADD CONSTRAINT "professional_general_cost_decisions_estimate_org_fkey"
 FOREIGN KEY ("general_estimate_id","organization_id")
 REFERENCES "public"."professional_general_estimates"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_general_cost_decisions" ADD CONSTRAINT "professional_general_cost_decisions_rule_org_component_fkey"
 FOREIGN KEY ("rule_definition_id","organization_id","component")
 REFERENCES "public"."professional_general_rule_definitions"("id","organization_id","component") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_general_rules_org_source_idx"
  ON "professional_general_rule_definitions" USING btree ("organization_id","source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_general_cost_decisions_org_estimate_idx"
  ON "professional_general_cost_decisions" USING btree ("organization_id","general_estimate_id");
