import {
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import {
  normativeApplicabilityDecisions,
  normativeSources,
  professionalGeneralEstimates,
} from "./professionalEstimates";

export const professionalGeneralRuleDefinitions = pgTable(
  "professional_general_rule_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
    applicabilityDecisionId: uuid("applicability_decision_id").notNull(),
    component: text("component").notNull(),
    ruleCode: text("rule_code").notNull(),
    groupCode: text("group_code").notNull(),
    groupLabel: text("group_label").notNull(),
    name: text("name").notNull(),
    valueType: text("value_type").notNull(),
    value: numeric("value", { precision: 18, scale: 6 }).notNull(),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    sourceReference: text("source_reference").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceOrgFk: foreignKey({
      columns: [table.sourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "professional_general_rules_source_org_fkey",
    }).onDelete("restrict"),
    applicabilitySourceOrgFk: foreignKey({
      columns: [
        table.applicabilityDecisionId,
        table.sourceId,
        table.organizationId,
      ],
      foreignColumns: [
        normativeApplicabilityDecisions.id,
        normativeApplicabilityDecisions.sourceId,
        normativeApplicabilityDecisions.organizationId,
      ],
      name: "professional_general_rules_applicability_source_org_fkey",
    }).onDelete("restrict"),
    idOrgUnique: unique("professional_general_rules_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    idOrgComponentUnique: unique(
      "professional_general_rules_id_org_component_unique",
    ).on(table.id, table.organizationId, table.component),
    packSlotUnique: unique("professional_general_rules_pack_slot_unique").on(
      table.organizationId,
      table.sourceId,
      table.applicabilityDecisionId,
      table.component,
      table.ruleCode,
    ),
    componentCheck: check(
      "professional_general_rules_component_check",
      sql`${table.component} = 'temporary_works'`,
    ),
    valueTypeCheck: check(
      "professional_general_rules_value_type_check",
      sql`${table.valueType} = 'percent'`,
    ),
    valueCheck: check(
      "professional_general_rules_value_check",
      sql`${table.value} > 0`,
    ),
    validityCheck: check(
      "professional_general_rules_validity_check",
      sql`${table.validTo} is null or ${table.validTo} >= ${table.validFrom}`,
    ),
    textCheck: check(
      "professional_general_rules_text_check",
      sql`length(trim(${table.ruleCode})) > 0
        and length(trim(${table.groupCode})) > 0
        and length(trim(${table.groupLabel})) > 0
        and length(trim(${table.name})) > 0
        and length(trim(${table.sourceReference})) > 0`,
    ),
    orgSourceIdx: index("professional_general_rules_org_source_idx").on(
      table.organizationId,
      table.sourceId,
    ),
  }),
);

export const professionalGeneralCostDecisions = pgTable(
  "professional_general_cost_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    generalEstimateId: uuid("general_estimate_id").notNull(),
    component: text("component").notNull(),
    mode: text("mode").notNull(),
    ruleDefinitionId: uuid("rule_definition_id"),
    projectCondition: text("project_condition"),
    projectConstructionAmount: numeric("project_construction_amount", {
      precision: 18,
      scale: 6,
    }),
    projectInstallationAmount: numeric("project_installation_amount", {
      precision: 18,
      scale: 6,
    }),
    projectReference: text("project_reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    generalEstimateOrgFk: foreignKey({
      columns: [table.generalEstimateId, table.organizationId],
      foreignColumns: [
        professionalGeneralEstimates.id,
        professionalGeneralEstimates.organizationId,
      ],
      name: "professional_general_cost_decisions_estimate_org_fkey",
    }).onDelete("cascade"),
    ruleOrgComponentFk: foreignKey({
      columns: [
        table.ruleDefinitionId,
        table.organizationId,
        table.component,
      ],
      foreignColumns: [
        professionalGeneralRuleDefinitions.id,
        professionalGeneralRuleDefinitions.organizationId,
        professionalGeneralRuleDefinitions.component,
      ],
      name: "professional_general_cost_decisions_rule_org_component_fkey",
    }).onDelete("restrict"),
    estimateComponentUnique: unique(
      "professional_general_cost_decisions_estimate_component_unique",
    ).on(table.organizationId, table.generalEstimateId, table.component),
    idOrgUnique: unique("professional_general_cost_decisions_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    componentCheck: check(
      "professional_general_cost_decisions_component_check",
      sql`${table.component} = 'temporary_works'`,
    ),
    modeCheck: check(
      "professional_general_cost_decisions_mode_check",
      sql`${table.mode} in ('normative_rate', 'project_calculation')`,
    ),
    shapeCheck: check(
      "professional_general_cost_decisions_shape_check",
      sql`(
        (
          ${table.mode} = 'normative_rate'
          and ${table.ruleDefinitionId} is not null
          and ${table.projectCondition} in (
            'standard',
            'reconstruction_or_extension_operating_facility',
            'road_reconstruction',
            'capital_repair_complex',
            'capital_repair_selective'
          )
          and ${table.projectConstructionAmount} is null
          and ${table.projectInstallationAmount} is null
          and ${table.projectReference} is null
        )
        or
        (
          ${table.mode} = 'project_calculation'
          and ${table.ruleDefinitionId} is null
          and ${table.projectCondition} is null
          and ${table.projectConstructionAmount} is not null
          and ${table.projectInstallationAmount} is not null
          and ${table.projectConstructionAmount} >= 0
          and ${table.projectInstallationAmount} >= 0
          and (${table.projectConstructionAmount} + ${table.projectInstallationAmount}) > 0
          and ${table.projectReference} is not null
          and length(trim(${table.projectReference})) > 0
        )
      )`,
    ),
    orgEstimateIdx: index(
      "professional_general_cost_decisions_org_estimate_idx",
    ).on(table.organizationId, table.generalEstimateId),
  }),
);

export type ProfessionalGeneralRuleDefinition =
  typeof professionalGeneralRuleDefinitions.$inferSelect;
export type ProfessionalGeneralCostDecision =
  typeof professionalGeneralCostDecisions.$inferSelect;
