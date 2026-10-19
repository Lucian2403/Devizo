import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import {
  normativeApplicabilityDecisions,
  normativeSources,
  professionalRuleDefinitions,
} from "@/infrastructure/db/schema";
import type {
  EstimatePerspective,
  ProfessionalRuleOrigin,
  ProfessionalWorkKind,
  RuleCalculationBasis,
  RuleValueType,
  ProfessionalCostStackComponent,
} from "@/domain/professional-estimates/calculation";
import type {
  ApplicabilityDecisionForRule,
  CompanyCalculationRuleSourceRecord,
  CreateProfessionalRuleDefinitionInput,
  ProfessionalRuleDefinitionRecord,
  ProfessionalRuleDefinitionRepository,
} from "@/domain/professional-estimates/professional-rule-definitions.repository";
import { COMPANY_CALCULATION_RULE_SOURCE_IDENTITY } from "@/domain/professional-estimates/professional-rule-definitions.repository";

function toRecord(
  row: typeof professionalRuleDefinitions.$inferSelect,
): ProfessionalRuleDefinitionRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sourceId: row.sourceId,
    applicabilityDecisionId: row.applicabilityDecisionId,
    name: row.name,
    component: row.component as ProfessionalCostStackComponent,
    valueType: row.valueType as RuleValueType,
    value: row.value,
    currency: row.currency,
    calculationBasis: row.calculationBasis as RuleCalculationBasis,
    validFrom: row.validFrom,
    validTo: row.validTo,
    estimatePerspective: row.estimatePerspective as EstimatePerspective | "any",
    workKind: row.workKind as ProfessionalWorkKind | "any",
    ruleOrigin: row.ruleOrigin as ProfessionalRuleOrigin,
    procurementCategory: row.procurementCategory,
    sourceReference: row.sourceReference,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleProfessionalRuleDefinitionRepository
  implements ProfessionalRuleDefinitionRepository
{
  async getCompanyCalculationRuleSource(
    organizationId: string,
  ): Promise<CompanyCalculationRuleSourceRecord | null> {
    const [row] = await db
      .select({
        id: normativeSources.id,
        organizationId: normativeSources.organizationId,
        code: normativeSources.code,
        edition: normativeSources.edition,
        title: normativeSources.title,
        sourceType: normativeSources.sourceType,
        jurisdiction: normativeSources.jurisdiction,
        status: normativeSources.status,
        officialStatus: normativeSources.officialStatus,
        monitoringEnabled: normativeSources.monitoringEnabled,
      })
      .from(normativeSources)
      .where(
        and(
          eq(normativeSources.organizationId, organizationId),
          eq(normativeSources.code, COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.code),
          eq(
            normativeSources.edition,
            COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.edition,
          ),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async insertCompanyCalculationRuleSourceIfAbsent(
    organizationId: string,
  ): Promise<CompanyCalculationRuleSourceRecord | null> {
    const [row] = await db
      .insert(normativeSources)
      .values({
        organizationId,
        ...COMPANY_CALCULATION_RULE_SOURCE_IDENTITY,
      })
      .onConflictDoNothing({
        target: [
          normativeSources.organizationId,
          normativeSources.code,
          normativeSources.edition,
        ],
      })
      .returning({
        id: normativeSources.id,
        organizationId: normativeSources.organizationId,
        code: normativeSources.code,
        edition: normativeSources.edition,
        title: normativeSources.title,
        sourceType: normativeSources.sourceType,
        jurisdiction: normativeSources.jurisdiction,
        status: normativeSources.status,
        officialStatus: normativeSources.officialStatus,
        monitoringEnabled: normativeSources.monitoringEnabled,
      });
    return row ?? null;
  }

  async createRuleDefinition(
    input: CreateProfessionalRuleDefinitionInput,
  ): Promise<ProfessionalRuleDefinitionRecord> {
    const [row] = await db
      .insert(professionalRuleDefinitions)
      .values({
        organizationId: input.organizationId,
        sourceId: input.sourceId,
        applicabilityDecisionId: input.applicabilityDecisionId ?? null,
        name: input.name,
        component: input.component,
        valueType: input.valueType,
        value: input.value,
        currency: input.currency ?? null,
        calculationBasis: input.calculationBasis,
        validFrom: input.validFrom,
        validTo: input.validTo ?? null,
        estimatePerspective: input.estimatePerspective,
        workKind: input.workKind,
        ruleOrigin: input.ruleOrigin,
        procurementCategory: input.procurementCategory ?? null,
        sourceReference: input.sourceReference ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to insert professional rule definition.");
    }
    return toRecord(row);
  }

  async getRuleDefinition(
    organizationId: string,
    id: string,
  ): Promise<ProfessionalRuleDefinitionRecord | null> {
    const [row] = await db
      .select()
      .from(professionalRuleDefinitions)
      .where(
        and(
          eq(professionalRuleDefinitions.organizationId, organizationId),
          eq(professionalRuleDefinitions.id, id),
        ),
      )
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async listRuleDefinitionsForComponent(
    organizationId: string,
    component: ProfessionalCostStackComponent,
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    const rows = await db
      .select()
      .from(professionalRuleDefinitions)
      .where(
        and(
          eq(professionalRuleDefinitions.organizationId, organizationId),
          eq(professionalRuleDefinitions.component, component),
        ),
      );
    return rows.map(toRecord);
  }

  async listRuleDefinitions(
    organizationId: string,
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    const rows = await db
      .select()
      .from(professionalRuleDefinitions)
      .where(eq(professionalRuleDefinitions.organizationId, organizationId));
    return rows.map(toRecord);
  }

  async listRuleDefinitionsForSource(
    organizationId: string,
    sourceId: string,
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    const rows = await db
      .select()
      .from(professionalRuleDefinitions)
      .where(
        and(
          eq(professionalRuleDefinitions.organizationId, organizationId),
          eq(professionalRuleDefinitions.sourceId, sourceId),
        ),
      );
    return rows.map(toRecord);
  }

  async getApplicabilityDecisionForSource(
    organizationId: string,
    sourceId: string,
    applicabilityDecisionId: string,
  ): Promise<ApplicabilityDecisionForRule | null> {
    const [row] = await db
      .select({
        id: normativeApplicabilityDecisions.id,
        sourceId: normativeApplicabilityDecisions.sourceId,
        decision: normativeApplicabilityDecisions.decision,
        applicableFrom: normativeApplicabilityDecisions.applicableFrom,
        applicableUntil: normativeApplicabilityDecisions.applicableUntil,
      })
      .from(normativeApplicabilityDecisions)
      .where(
        and(
          eq(normativeApplicabilityDecisions.organizationId, organizationId),
          eq(normativeApplicabilityDecisions.sourceId, sourceId),
          eq(normativeApplicabilityDecisions.id, applicabilityDecisionId),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}
