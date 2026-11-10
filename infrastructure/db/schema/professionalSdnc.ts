import { sql } from "drizzle-orm";
import {
  boolean, check, foreignKey, integer, numeric, pgTable, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { professionalGeneralEstimates } from "./professionalEstimates";

/** An annual fiscal decision; never reuse the General Estimate's total as tax base. */
export const professionalSdncDecisions = pgTable("professional_sdnc_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  generalEstimateId: uuid("general_estimate_id").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  legalVersion: text("legal_version").notNull(),
  mode: text("mode").notNull(),
  workKind: text("work_kind"),
  permitConfirmed: boolean("permit_confirmed").notNull().default(false),
  nonPublicFundingConfirmed: boolean("non_public_funding_confirmed").notNull().default(false),
  notExemptHouseConfirmed: boolean("not_exempt_house_confirmed").notNull().default(false),
  annualEligibleInvestmentMdl: numeric("annual_eligible_investment_mdl", {
    precision: 22, scale: 4,
  }),
  supportingDocument: text("supporting_document"),
  exclusionReason: text("exclusion_reason"),
  basisNote: text("basis_note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  estimateOrgFk: foreignKey({
    columns: [t.generalEstimateId, t.organizationId],
    foreignColumns: [professionalGeneralEstimates.id, professionalGeneralEstimates.organizationId],
    name: "professional_sdnc_estimate_org_fkey",
  }).onDelete("cascade"),
  estimateUnique: unique("professional_sdnc_estimate_unique")
    .on(t.organizationId, t.generalEstimateId),
  fiscalCheck: check("professional_sdnc_fiscal_2026_check",
    sql`${t.fiscalYear} = 2026 and ${t.legalVersion} = 'MD-SDNC-2026-L153-SFS432'`),
  noteCheck: check("professional_sdnc_note_check",
    sql`length(trim(${t.basisNote})) between 1 and 4000`),
  modeCheck: check("professional_sdnc_mode_shape_check", sql`(
    (${t.mode} = 'liable'
      and ${t.workKind} is not null and ${t.workKind} in ('new_construction','existing_intervention')
      and ${t.permitConfirmed} = true
      and ${t.nonPublicFundingConfirmed} = true
      and ${t.notExemptHouseConfirmed} = true
      and ${t.annualEligibleInvestmentMdl} is not null
      and ${t.annualEligibleInvestmentMdl} >= 0
      and ${t.supportingDocument} is not null
      and length(trim(${t.supportingDocument})) between 1 and 4000
      and ${t.exclusionReason} is null)
    or
    (${t.mode} = 'not_liable'
      and ${t.workKind} is null
      and ${t.permitConfirmed} = false
      and ${t.nonPublicFundingConfirmed} = false
      and ${t.notExemptHouseConfirmed} = false
      and ${t.annualEligibleInvestmentMdl} is null
      and ${t.supportingDocument} is null
      and ${t.exclusionReason} is not null and ${t.exclusionReason} in (
        'public_budget','no_building_permit',
        'personal_individual_house','outside_eligible_works'))
  )`),
}));
