import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import {
  parseDecimal,
  toDecimalString,
} from "@/domain/professional-estimates/calculation";
import {
  normativeApplicabilityDecisions,
  normativeSources,
  professionalGeneralCostDecisions,
  professionalGeneralEstimates,
  professionalGeneralRuleDefinitions,
} from "@/infrastructure/db/schema";
import type {
  CreateProfessionalGeneralRuleDefinitionInput,
  ProfessionalGeneralCostDecisionRecord,
  ProfessionalGeneralEstimateContextRecord,
  ProfessionalGeneralRuleDefinitionRecord,
  ProfessionalTemporaryWorksRepository,
  SaveProfessionalGeneralCostDecisionInput,
  TemporaryWorksApplicabilityDecision,
  TemporaryWorksNormativeSource,
} from "@/domain/professional-estimates/professional-temporary-works.repository";

function mapSource(
  row: typeof normativeSources.$inferSelect,
): TemporaryWorksNormativeSource {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    title: row.title,
    edition: row.edition,
    sourceType: row.sourceType,
    jurisdiction: row.jurisdiction,
    status: row.status,
    officialStatus: row.officialStatus,
    effectiveDate: row.effectiveDate,
    validFrom: row.validFrom,
    validTo: row.validTo,
    sourceUri: row.sourceUri,
  };
}

function mapApplicability(
  row: typeof normativeApplicabilityDecisions.$inferSelect,
): TemporaryWorksApplicabilityDecision {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sourceId: row.sourceId,
    revision: row.revision,
    decision: row.decision,
    applicableFrom: row.applicableFrom,
    applicableUntil: row.applicableUntil,
    officialStatus: row.officialStatus,
    sourceCode: row.sourceCode,
    sourceEdition: row.sourceEdition,
    basisNote: row.basisNote,
  };
}

function canonicalDecimal(value: string): string {
  return toDecimalString(parseDecimal(value, "persistedDecimal"));
}

function optionalCanonicalDecimal(value: string | null): string | null {
  return value === null ? null : canonicalDecimal(value);
}

function mapRule(
  row: typeof professionalGeneralRuleDefinitions.$inferSelect,
): ProfessionalGeneralRuleDefinitionRecord {
  return {
    ...row,
    value: canonicalDecimal(row.value),
    component: "temporary_works",
    valueType: "percent",
  };
}

function mapDecision(
  row: typeof professionalGeneralCostDecisions.$inferSelect,
): ProfessionalGeneralCostDecisionRecord {
  return {
    ...row,
    projectConstructionAmount: optionalCanonicalDecimal(
      row.projectConstructionAmount,
    ),
    projectInstallationAmount: optionalCanonicalDecimal(
      row.projectInstallationAmount,
    ),
    component: "temporary_works",
    mode: row.mode as ProfessionalGeneralCostDecisionRecord["mode"],
    projectCondition:
      row.projectCondition as ProfessionalGeneralCostDecisionRecord["projectCondition"],
  };
}

export class DrizzleProfessionalTemporaryWorksRepository
  implements ProfessionalTemporaryWorksRepository
{
  async findSourceByIdentity(
    organizationId: string,
    code: string,
    edition: string,
  ): Promise<TemporaryWorksNormativeSource | null> {
    const [row] = await db
      .select()
      .from(normativeSources)
      .where(
        and(
          eq(normativeSources.organizationId, organizationId),
          eq(normativeSources.code, code),
          eq(normativeSources.edition, edition),
        ),
      )
      .limit(1);
    return row ? mapSource(row) : null;
  }

  async getSource(
    organizationId: string,
    sourceId: string,
  ): Promise<TemporaryWorksNormativeSource | null> {
    const [row] = await db
      .select()
      .from(normativeSources)
      .where(
        and(
          eq(normativeSources.organizationId, organizationId),
          eq(normativeSources.id, sourceId),
        ),
      )
      .limit(1);
    return row ? mapSource(row) : null;
  }

  async listApplicabilityDecisions(
    organizationId: string,
    sourceId: string,
  ): Promise<TemporaryWorksApplicabilityDecision[]> {
    const rows = await db
      .select()
      .from(normativeApplicabilityDecisions)
      .where(
        and(
          eq(normativeApplicabilityDecisions.organizationId, organizationId),
          eq(normativeApplicabilityDecisions.sourceId, sourceId),
        ),
      )
      .orderBy(desc(normativeApplicabilityDecisions.revision));
    return rows.map(mapApplicability);
  }

  async getApplicabilityDecision(
    organizationId: string,
    sourceId: string,
    applicabilityDecisionId: string,
  ): Promise<TemporaryWorksApplicabilityDecision | null> {
    const [row] = await db
      .select()
      .from(normativeApplicabilityDecisions)
      .where(
        and(
          eq(normativeApplicabilityDecisions.organizationId, organizationId),
          eq(normativeApplicabilityDecisions.sourceId, sourceId),
          eq(normativeApplicabilityDecisions.id, applicabilityDecisionId),
        ),
      )
      .limit(1);
    return row ? mapApplicability(row) : null;
  }

  async listRuleDefinitions(
    organizationId: string,
    sourceId: string,
  ): Promise<ProfessionalGeneralRuleDefinitionRecord[]> {
    const rows = await db
      .select()
      .from(professionalGeneralRuleDefinitions)
      .where(
        and(
          eq(professionalGeneralRuleDefinitions.organizationId, organizationId),
          eq(professionalGeneralRuleDefinitions.sourceId, sourceId),
          eq(
            professionalGeneralRuleDefinitions.component,
            "temporary_works",
          ),
        ),
      )
      .orderBy(professionalGeneralRuleDefinitions.ruleCode);
    return rows.map(mapRule);
  }

  async createRuleDefinitions(
    inputs: readonly CreateProfessionalGeneralRuleDefinitionInput[],
  ): Promise<ProfessionalGeneralRuleDefinitionRecord[]> {
    if (inputs.length === 0) return [];
    return db.transaction(async (tx) => {
      const rows = await tx
        .insert(professionalGeneralRuleDefinitions)
        .values(
          inputs.map((input) => ({
            organizationId: input.organizationId,
            sourceId: input.sourceId,
            applicabilityDecisionId: input.applicabilityDecisionId,
            component: input.component,
            ruleCode: input.ruleCode,
            groupCode: input.groupCode,
            groupLabel: input.groupLabel,
            name: input.name,
            valueType: input.valueType,
            value: input.value,
            validFrom: input.validFrom,
            validTo: input.validTo,
            sourceReference: input.sourceReference,
          })),
        )
        .returning();
      return rows.map(mapRule);
    });
  }

  async rebindRuleDefinitionsApplicability(
    organizationId: string,
    sourceId: string,
    ruleDefinitionIds: readonly string[],
    applicabilityDecisionId: string,
  ): Promise<ProfessionalGeneralRuleDefinitionRecord[]> {
    if (ruleDefinitionIds.length === 0) return [];

    return db.transaction(async (tx) => {
      const rows = await tx
        .update(professionalGeneralRuleDefinitions)
        .set({
          applicabilityDecisionId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(professionalGeneralRuleDefinitions.organizationId, organizationId),
            eq(professionalGeneralRuleDefinitions.sourceId, sourceId),
            eq(professionalGeneralRuleDefinitions.component, "temporary_works"),
            inArray(professionalGeneralRuleDefinitions.id, [...ruleDefinitionIds]),
          ),
        )
        .returning();

      if (rows.length !== ruleDefinitionIds.length) {
        throw new Error(
          "Nu s-a putut actualiza proveniența tuturor regulilor pentru construcțiile provizorii.",
        );
      }
      return rows.map(mapRule);
    });
  }

  async getRuleDefinition(
    organizationId: string,
    ruleDefinitionId: string,
  ): Promise<ProfessionalGeneralRuleDefinitionRecord | null> {
    const [row] = await db
      .select()
      .from(professionalGeneralRuleDefinitions)
      .where(
        and(
          eq(professionalGeneralRuleDefinitions.organizationId, organizationId),
          eq(professionalGeneralRuleDefinitions.id, ruleDefinitionId),
          eq(
            professionalGeneralRuleDefinitions.component,
            "temporary_works",
          ),
        ),
      )
      .limit(1);
    return row ? mapRule(row) : null;
  }

  async getGeneralEstimate(
    organizationId: string,
    generalEstimateId: string,
  ): Promise<ProfessionalGeneralEstimateContextRecord | null> {
    const [row] = await db
      .select({
        id: professionalGeneralEstimates.id,
        organizationId: professionalGeneralEstimates.organizationId,
        valuationDate: professionalGeneralEstimates.valuationDate,
        currency: professionalGeneralEstimates.currency,
      })
      .from(professionalGeneralEstimates)
      .where(
        and(
          eq(professionalGeneralEstimates.organizationId, organizationId),
          eq(professionalGeneralEstimates.id, generalEstimateId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async getDecision(
    organizationId: string,
    generalEstimateId: string,
  ): Promise<ProfessionalGeneralCostDecisionRecord | null> {
    const [row] = await db
      .select()
      .from(professionalGeneralCostDecisions)
      .where(
        and(
          eq(professionalGeneralCostDecisions.organizationId, organizationId),
          eq(
            professionalGeneralCostDecisions.generalEstimateId,
            generalEstimateId,
          ),
          eq(
            professionalGeneralCostDecisions.component,
            "temporary_works",
          ),
        ),
      )
      .limit(1);
    return row ? mapDecision(row) : null;
  }

  async saveDecision(
    organizationId: string,
    generalEstimateId: string,
    input: SaveProfessionalGeneralCostDecisionInput,
  ): Promise<ProfessionalGeneralCostDecisionRecord> {
    const values =
      input.mode === "normative_rate"
        ? {
            organizationId,
            generalEstimateId,
            component: "temporary_works" as const,
            mode: "normative_rate" as const,
            ruleDefinitionId: input.ruleDefinitionId,
            projectCondition: input.projectCondition,
            projectConstructionAmount: null,
            projectInstallationAmount: null,
            projectReference: null,
          }
        : {
            organizationId,
            generalEstimateId,
            component: "temporary_works" as const,
            mode: "project_calculation" as const,
            ruleDefinitionId: null,
            projectCondition: null,
            projectConstructionAmount: input.projectConstructionAmount,
            projectInstallationAmount: input.projectInstallationAmount,
            projectReference: input.projectReference,
          };

    const [row] = await db
      .insert(professionalGeneralCostDecisions)
      .values(values)
      .onConflictDoUpdate({
        target: [
          professionalGeneralCostDecisions.organizationId,
          professionalGeneralCostDecisions.generalEstimateId,
          professionalGeneralCostDecisions.component,
        ],
        set: {
          mode: values.mode,
          ruleDefinitionId: values.ruleDefinitionId,
          projectCondition: values.projectCondition,
          projectConstructionAmount: values.projectConstructionAmount,
          projectInstallationAmount: values.projectInstallationAmount,
          projectReference: values.projectReference,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) {
      throw new Error("Nu s-a putut salva decizia pentru construcțiile provizorii.");
    }
    return mapDecision(row);
  }
}
