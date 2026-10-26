import { sql } from "drizzle-orm";
import {
  boolean, check, date, foreignKey, integer, pgTable, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { professionalGeneralEstimates } from "./professionalEstimates";
import { professionalGeneralRuleDefinitions } from "./professionalGeneralCosts";

/** Winter costs are a distinct decision, never an alias for temporary works. */
export const professionalWinterDecisions = pgTable("professional_winter_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  generalEstimateId: uuid("general_estimate_id").notNull(),
  ruleComponent: text("rule_component").notNull().default("winter_conditions"),
  mode: text("mode").notNull(),
  ruleDefinitionId: uuid("rule_definition_id"),
  periodKind: text("period_kind"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  winterDays: integer("winter_days"),
  projectReference: text("project_reference"),
  buildingScope: text("building_scope"),
  principalWorkConfirmed: boolean("principal_work_confirmed").notNull().default(false),
  classification: text("classification"),
  analogyReference: text("analogy_reference"),
  exclusionReason: text("exclusion_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  estimateOrgFk: foreignKey({
    columns: [t.generalEstimateId, t.organizationId],
    foreignColumns: [professionalGeneralEstimates.id, professionalGeneralEstimates.organizationId],
    name: "professional_winter_decisions_estimate_org_fkey",
  }).onDelete("cascade"),
  ruleOrgFk: foreignKey({
    columns: [t.ruleDefinitionId, t.organizationId, t.ruleComponent],
    foreignColumns: [
      professionalGeneralRuleDefinitions.id,
      professionalGeneralRuleDefinitions.organizationId,
      professionalGeneralRuleDefinitions.component,
    ],
    name: "professional_winter_decisions_rule_org_component_fkey",
  }).onDelete("restrict"),
  estimateUnique: unique("professional_winter_decisions_estimate_unique")
    .on(t.organizationId, t.generalEstimateId),
  componentCheck: check("professional_winter_decisions_component_check",
    sql`${t.ruleComponent} = 'winter_conditions'`),
  shapeCheck: check("professional_winter_decisions_shape_check", sql`(
    (${t.mode} = 'not_applicable'
      and ${t.exclusionReason} = 'heated_current_repair'
      and ${t.ruleDefinitionId} is null and ${t.periodKind} is null
      and ${t.startDate} is null and ${t.endDate} is null
      and ${t.winterDays} is null and ${t.projectReference} is null
      and ${t.buildingScope} is null and ${t.classification} is null
      and ${t.analogyReference} is null and ${t.principalWorkConfirmed} = false)
    or
    (${t.mode} = 'normative_rate' and ${t.ruleDefinitionId} is not null
      and ${t.exclusionReason} is null
      and ${t.periodKind} in ('annual_average','short_project')
      and ${t.buildingScope} in ('residential_administrative','other')
      and ${t.classification} in ('listed','analogous')
      and ((${t.classification} = 'listed' and ${t.analogyReference} is null)
        or (${t.classification} = 'analogous'
          and ${t.analogyReference} is not null
          and length(trim(${t.analogyReference})) > 0))
      and ((${t.periodKind} = 'annual_average'
        and ${t.startDate} is null and ${t.endDate} is null
        and ${t.winterDays} is null and ${t.projectReference} is null)
      or (${t.periodKind} = 'short_project'
        and ${t.startDate} is not null and ${t.endDate} is not null
        and ${t.endDate} >= ${t.startDate}
        and ${t.winterDays} is not null and ${t.winterDays} >= 0
        and ${t.projectReference} is not null
        and length(trim(${t.projectReference})) > 0)))
  )`),
}));

export type ProfessionalWinterDecision = typeof professionalWinterDecisions.$inferSelect;
