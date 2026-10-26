-- M8.5C2B2: winter-conditions decisions are separate from temporary-works choices.
CREATE TABLE "professional_winter_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "general_estimate_id" uuid NOT NULL,
  "rule_component" text DEFAULT 'winter_conditions' NOT NULL,
  "mode" text NOT NULL,
  "rule_definition_id" uuid,
  "period_kind" text,
  "start_date" date,
  "end_date" date,
  "winter_days" integer,
  "project_reference" text,
  "building_scope" text,
  "principal_work_confirmed" boolean DEFAULT false NOT NULL,
  "classification" text,
  "analogy_reference" text,
  "exclusion_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "professional_winter_decisions_estimate_unique"
    UNIQUE ("organization_id", "general_estimate_id"),
  CONSTRAINT "professional_winter_decisions_component_check"
    CHECK (rule_component = 'winter_conditions'),
  CONSTRAINT "professional_winter_decisions_shape_check" CHECK (
    (mode = 'not_applicable'
      AND exclusion_reason = 'heated_current_repair'
      AND rule_definition_id IS NULL AND period_kind IS NULL
      AND start_date IS NULL AND end_date IS NULL AND winter_days IS NULL
      AND project_reference IS NULL AND building_scope IS NULL
      AND classification IS NULL AND analogy_reference IS NULL
      AND principal_work_confirmed = false)
    OR
    (mode = 'normative_rate' AND rule_definition_id IS NOT NULL
      AND exclusion_reason IS NULL
      AND period_kind IN ('annual_average', 'short_project')
      AND building_scope IN ('residential_administrative', 'other')
      AND classification IN ('listed','analogous')
      AND ((classification = 'listed' AND analogy_reference IS NULL)
        OR (classification = 'analogous' AND analogy_reference IS NOT NULL
          AND length(trim(analogy_reference)) > 0))
      AND ((period_kind = 'annual_average'
        AND start_date IS NULL AND end_date IS NULL
        AND winter_days IS NULL AND project_reference IS NULL)
      OR (period_kind = 'short_project' AND start_date IS NOT NULL
        AND end_date IS NOT NULL AND end_date >= start_date
        AND winter_days IS NOT NULL AND winter_days >= 0
        AND project_reference IS NOT NULL
        AND length(trim(project_reference)) > 0)))
  )
);
--> statement-breakpoint
ALTER TABLE "professional_winter_decisions"
  ADD CONSTRAINT "professional_winter_decisions_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "professional_winter_decisions"
  ADD CONSTRAINT "professional_winter_decisions_estimate_org_fkey"
  FOREIGN KEY ("general_estimate_id","organization_id")
  REFERENCES "public"."professional_general_estimates"("id","organization_id")
  ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "professional_winter_decisions"
  ADD CONSTRAINT "professional_winter_decisions_rule_org_component_fkey"
  FOREIGN KEY ("rule_definition_id","organization_id","rule_component")
  REFERENCES "public"."professional_general_rule_definitions"("id","organization_id","component")
  ON DELETE restrict;
