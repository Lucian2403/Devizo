-- Reserve after Chapters 1–12 (CP L.01.01-2012, 6.11).
-- One explicit, source-bound decision per organization and general estimate.
CREATE TABLE "professional_general_reserve_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "general_estimate_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "applicability_decision_id" uuid NOT NULL,
  "category" text NOT NULL,
  "basis_note" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "professional_general_reserve_estimate_unique"
    UNIQUE ("organization_id","general_estimate_id"),
  CONSTRAINT "professional_general_reserve_category_check"
    CHECK ("category" IN ('social','production','feasibility')),
  CONSTRAINT "professional_general_reserve_note_check"
    CHECK (length(trim("basis_note")) BETWEEN 1 AND 4000)
);
--> statement-breakpoint
ALTER TABLE "professional_general_reserve_decisions"
  ADD CONSTRAINT "professional_general_reserve_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "professional_general_reserve_decisions"
  ADD CONSTRAINT "professional_general_reserve_estimate_org_fkey"
  FOREIGN KEY ("general_estimate_id","organization_id")
  REFERENCES "public"."professional_general_estimates"("id","organization_id")
  ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "professional_general_reserve_decisions"
  ADD CONSTRAINT "professional_general_reserve_source_org_fkey"
  FOREIGN KEY ("source_id","organization_id")
  REFERENCES "public"."normative_sources"("id","organization_id")
  ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "professional_general_reserve_decisions"
  ADD CONSTRAINT "professional_general_reserve_applicability_source_org_fkey"
  FOREIGN KEY ("applicability_decision_id","source_id","organization_id")
  REFERENCES "public"."normative_applicability_decisions"("id","source_id","organization_id")
  ON DELETE restrict;
