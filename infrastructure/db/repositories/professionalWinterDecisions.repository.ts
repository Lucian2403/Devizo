import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { professionalWinterDecisions } from "@/infrastructure/db/schema";
import { DrizzleProfessionalTemporaryWorksRepository } from "./professionalTemporaryWorks.repository";
import type {
  PersistedWinterDecisionInput,
  ProfessionalWinterDecisionsRepository,
  WinterDecisionRecord,
} from "@/domain/professional-estimates/professional-winter-decisions.repository";

function mapDecision(
  row: typeof professionalWinterDecisions.$inferSelect,
): WinterDecisionRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    generalEstimateId: row.generalEstimateId,
    mode: row.mode as WinterDecisionRecord["mode"],
    ruleDefinitionId: row.ruleDefinitionId,
    periodKind: row.periodKind as WinterDecisionRecord["periodKind"],
    startDate: row.startDate,
    endDate: row.endDate,
    winterDays: row.winterDays,
    projectReference: row.projectReference,
    buildingScope: row.buildingScope as WinterDecisionRecord["buildingScope"],
    principalWorkConfirmed: row.principalWorkConfirmed,
    classification: row.classification as WinterDecisionRecord["classification"],
    analogyReference: row.analogyReference,
    exclusionReason: row.exclusionReason as WinterDecisionRecord["exclusionReason"],
    updatedAt: row.updatedAt,
  };
}

export class DrizzleProfessionalWinterDecisionsRepository
  implements ProfessionalWinterDecisionsRepository
{
  private readonly estimates = new DrizzleProfessionalTemporaryWorksRepository();

  async getGeneralEstimate(org: string, generalEstimateId: string) {
    return this.estimates.getGeneralEstimate(org, generalEstimateId);
  }

  async getDecision(org: string, generalEstimateId: string) {
    const [row] = await db.select().from(professionalWinterDecisions)
      .where(and(
        eq(professionalWinterDecisions.organizationId, org),
        eq(professionalWinterDecisions.generalEstimateId, generalEstimateId),
      )).limit(1);
    return row ? mapDecision(row) : null;
  }

  async saveDecision(
    org: string, generalEstimateId: string, input: PersistedWinterDecisionInput,
  ) {
    const values = {
      organizationId: org,
      generalEstimateId,
      ruleComponent: "winter_conditions" as const,
      ...input,
    };
    const [row] = await db.insert(professionalWinterDecisions).values(values)
      .onConflictDoUpdate({
        target: [
          professionalWinterDecisions.organizationId,
          professionalWinterDecisions.generalEstimateId,
        ],
        set: { ...input, updatedAt: new Date() },
      }).returning();
    if (!row) throw new Error("Nu s-a putut salva decizia pentru timp friguros.");
    return mapDecision(row);
  }
}
