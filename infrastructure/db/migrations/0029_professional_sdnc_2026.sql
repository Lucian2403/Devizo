-- Annual SDNC decision, fiscal year 2026, never the whole General Estimate by default.
CREATE TABLE "professional_sdnc_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "general_estimate_id" uuid NOT NULL,
  "fiscal_year" integer NOT NULL,
  "legal_version" text NOT NULL,
  "mode" text NOT NULL,
  "work_kind" text,
  "permit_confirmed" boolean DEFAULT false NOT NULL,
  "non_public_funding_confirmed" boolean DEFAULT false NOT NULL,
  "not_exempt_house_confirmed" boolean DEFAULT false NOT NULL,
  "annual_eligible_investment_mdl" numeric(22,4),
  "supporting_document" text,
  "exclusion_reason" text,
  "basis_note" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "professional_sdnc_estimate_unique"
    UNIQUE ("organization_id","general_estimate_id"),
  CONSTRAINT "professional_sdnc_fiscal_2026_check"
    CHECK ("fiscal_year" = 2026 AND "legal_version" = 'MD-SDNC-2026-L153-SFS432'),
  CONSTRAINT "professional_sdnc_note_check"
    CHECK (length(trim("basis_note")) BETWEEN 1 AND 4000),
  CONSTRAINT "professional_sdnc_mode_shape_check"
    CHECK (
      ("mode" = 'liable'
        AND "work_kind" IN ('new_construction','existing_intervention')
        AND "permit_confirmed" = true
        AND "non_public_funding_confirmed" = true
        AND "not_exempt_house_confirmed" = true
        AND "annual_eligible_investment_mdl" IS NOT NULL
        AND "annual_eligible_investment_mdl" >= 0
        AND "supporting_document" IS NOT NULL
        AND length(trim("supporting_document")) BETWEEN 1 AND 4000
        AND "exclusion_reason" IS NULL)
      OR
      ("mode" = 'not_liable'
        AND "work_kind" IS NULL
        AND "permit_confirmed" = false
        AND "non_public_funding_confirmed" = false
        AND "not_exempt_house_confirmed" = false
        AND "annual_eligible_investment_mdl" IS NULL
        AND "supporting_document" IS NULL
        AND "exclusion_reason" IN ('public_budget','no_building_permit',
          'personal_individual_house','outside_eligible_works'))
    )
);
--> statement-breakpoint
ALTER TABLE "professional_sdnc_decisions"
  ADD CONSTRAINT "professional_sdnc_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "professional_sdnc_decisions"
  ADD CONSTRAINT "professional_sdnc_estimate_org_fkey"
  FOREIGN KEY ("general_estimate_id","organization_id")
  REFERENCES "public"."professional_general_estimates"("id","organization_id")
  ON DELETE cascade;
