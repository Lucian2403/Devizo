ALTER TABLE "professional_rule_definitions" ADD CONSTRAINT "professional_rule_definitions_id_org_component_unique" UNIQUE("id","organization_id","component");
--> statement-breakpoint
ALTER TABLE "professional_cost_component_decisions" DROP CONSTRAINT "professional_cost_component_decisions_rule_org_fkey";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "professional_cost_component_decisions" ADD CONSTRAINT "professional_cost_component_decisions_rule_org_component_fkey" FOREIGN KEY ("professional_rule_definition_id","organization_id","component") REFERENCES "public"."professional_rule_definitions"("id","organization_id","component") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;