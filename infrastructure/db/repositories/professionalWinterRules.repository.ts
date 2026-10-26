import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { parseDecimal, toDecimalString } from "@/domain/professional-estimates/calculation";
import { professionalGeneralRuleDefinitions } from "@/infrastructure/db/schema";
import { DrizzleProfessionalTemporaryWorksRepository } from "./professionalTemporaryWorks.repository";
import type {
  CreateWinterRuleDefinitionInput,
  ProfessionalWinterRulesRepository,
  WinterRuleDefinitionRecord,
} from "@/domain/professional-estimates/professional-winter-rules.repository";

function mapRule(
  row: typeof professionalGeneralRuleDefinitions.$inferSelect,
): WinterRuleDefinitionRecord {
  if (row.component !== "winter_conditions" || row.valueType !== "percent") {
    throw new Error("Regula nu aparține pachetului NCM L.02.06-2012.");
  }
  return {
    ...row,
    component: "winter_conditions",
    valueType: "percent",
    value: toDecimalString(parseDecimal(row.value, "winterRate")),
  };
}

/** Reuses governance queries while isolating the winter component in SQL. */
export class DrizzleProfessionalWinterRulesRepository
  implements ProfessionalWinterRulesRepository
{
  private readonly governance = new DrizzleProfessionalTemporaryWorksRepository();

  async findSourceByIdentity(org: string, code: string, edition: string) {
    return this.governance.findSourceByIdentity(org, code, edition);
  }

  async getSource(org: string, sourceId: string) {
    return this.governance.getSource(org, sourceId);
  }

  async listApplicabilityDecisions(org: string, sourceId: string) {
    return this.governance.listApplicabilityDecisions(org, sourceId);
  }

  async getApplicabilityDecision(org: string, sourceId: string, decisionId: string) {
    return this.governance.getApplicabilityDecision(org, sourceId, decisionId);
  }

  async listRuleDefinitions(org: string, sourceId: string): Promise<WinterRuleDefinitionRecord[]> {
    const rows = await db
      .select()
      .from(professionalGeneralRuleDefinitions)
      .where(and(
        eq(professionalGeneralRuleDefinitions.organizationId, org),
        eq(professionalGeneralRuleDefinitions.sourceId, sourceId),
        eq(professionalGeneralRuleDefinitions.component, "winter_conditions"),
      ))
      .orderBy(professionalGeneralRuleDefinitions.ruleCode);
    return rows.map(mapRule);
  }

  async createRuleDefinitions(
    rules: readonly CreateWinterRuleDefinitionInput[],
  ): Promise<WinterRuleDefinitionRecord[]> {
    if (rules.length === 0) return [];
    if (rules.some((rule) => rule.component !== "winter_conditions")) {
      throw new Error("Componenta regulilor de iarnă este invalidă.");
    }
    return db.transaction(async (tx) => {
      const saved = await tx.insert(professionalGeneralRuleDefinitions)
        .values(rules.map((rule) => ({
          organizationId: rule.organizationId,
          sourceId: rule.sourceId,
          applicabilityDecisionId: rule.applicabilityDecisionId,
          component: "winter_conditions",
          ruleCode: rule.ruleCode,
          groupCode: rule.groupCode,
          groupLabel: rule.groupLabel,
          name: rule.name,
          valueType: "percent",
          value: rule.value,
          validFrom: rule.validFrom,
          validTo: rule.validTo,
          sourceReference: rule.sourceReference,
        })))
        .returning();
      return saved.map(mapRule);
    });
  }

  async rebindRuleDefinitionsApplicability(
    org: string,
    sourceId: string,
    ruleIds: readonly string[],
    decisionId: string,
  ): Promise<WinterRuleDefinitionRecord[]> {
    if (ruleIds.length === 0) return [];
    return db.transaction(async (tx) => {
      const saved = await tx.update(professionalGeneralRuleDefinitions)
        .set({ applicabilityDecisionId: decisionId, updatedAt: new Date() })
        .where(and(
          eq(professionalGeneralRuleDefinitions.organizationId, org),
          eq(professionalGeneralRuleDefinitions.sourceId, sourceId),
          eq(professionalGeneralRuleDefinitions.component, "winter_conditions"),
          inArray(professionalGeneralRuleDefinitions.id, [...ruleIds]),
        ))
        .returning();
      if (saved.length !== ruleIds.length) {
        throw new Error("Actualizarea provenienței regulilor de iarnă nu este completă.");
      }
      return saved.map(mapRule);
    });
  }
}
