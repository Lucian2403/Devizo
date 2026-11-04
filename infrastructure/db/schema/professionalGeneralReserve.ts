import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import {
  normativeApplicabilityDecisions, normativeSources, professionalGeneralEstimates,
} from "./professionalEstimates";

/** Separate post-Chapter-12 reserve decision; it does not mutate Chapter 9. */
export const professionalGeneralReserveDecisions = pgTable(
  "professional_general_reserve_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    generalEstimateId: uuid("general_estimate_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    applicabilityDecisionId: uuid("applicability_decision_id").notNull(),
    category: text("category").notNull(),
    basisNote: text("basis_note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    estimateOrgFk: foreignKey({
      columns: [t.generalEstimateId, t.organizationId],
      foreignColumns: [professionalGeneralEstimates.id, professionalGeneralEstimates.organizationId],
      name: "professional_general_reserve_estimate_org_fkey",
    }).onDelete("cascade"),
    sourceOrgFk: foreignKey({
      columns: [t.sourceId, t.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "professional_general_reserve_source_org_fkey",
    }).onDelete("restrict"),
    applicabilitySourceOrgFk: foreignKey({
      columns: [t.applicabilityDecisionId, t.sourceId, t.organizationId],
      foreignColumns: [
        normativeApplicabilityDecisions.id,
        normativeApplicabilityDecisions.sourceId,
        normativeApplicabilityDecisions.organizationId,
      ],
      name: "professional_general_reserve_applicability_source_org_fkey",
    }).onDelete("restrict"),
    estimateUnique: unique("professional_general_reserve_estimate_unique")
      .on(t.organizationId, t.generalEstimateId),
    categoryCheck: check("professional_general_reserve_category_check",
      sql`${t.category} in ('social','production','feasibility')`),
    noteCheck: check("professional_general_reserve_note_check",
      sql`length(trim(${t.basisNote})) between 1 and 4000`),
  }),
);
