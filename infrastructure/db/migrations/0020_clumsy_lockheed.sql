CREATE TABLE IF NOT EXISTS "professional_cost_component_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"calculation_context_id" uuid NOT NULL,
	"component" text NOT NULL,
	"decision" text NOT NULL,
	"professional_rule_definition_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_cost_component_decisions_context_component_unique" UNIQUE("organization_id","calculation_context_id","component"),
	CONSTRAINT "professional_cost_component_decisions_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "professional_cost_component_decisions_component_check" CHECK ("professional_cost_component_decisions"."component" in ('labor_contributions', 'material_transport', 'overhead', 'estimated_profit')),
	CONSTRAINT "professional_cost_component_decisions_decision_check" CHECK ("professional_cost_component_decisions"."decision" in ('applied', 'not_applicable')),
	CONSTRAINT "professional_cost_component_decisions_shape_check" CHECK ((
        ("professional_cost_component_decisions"."decision" = 'applied' and "professional_cost_component_decisions"."professional_rule_definition_id" is not null and "professional_cost_component_decisions"."reason" is null)
        or
        ("professional_cost_component_decisions"."decision" = 'not_applicable' and "professional_cost_component_decisions"."professional_rule_definition_id" is null and "professional_cost_component_decisions"."reason" is not null and length(trim("professional_cost_component_decisions"."reason")) > 0)
      ))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_cost_component_decisions" ADD CONSTRAINT "professional_cost_component_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_cost_component_decisions" ADD CONSTRAINT "professional_cost_component_decisions_context_org_fkey" FOREIGN KEY ("calculation_context_id","organization_id") REFERENCES "public"."calculation_contexts"("id","organization_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_cost_component_decisions" ADD CONSTRAINT "professional_cost_component_decisions_rule_org_fkey" FOREIGN KEY ("professional_rule_definition_id","organization_id") REFERENCES "public"."professional_rule_definitions"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_cost_component_decisions_org_context_component_idx" ON "professional_cost_component_decisions" USING btree ("organization_id","calculation_context_id","component");