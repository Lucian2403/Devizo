import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { professionalGeneralReserveDecisions } from "@/infrastructure/db/schema";
import { DrizzleProfessionalTemporaryWorksRepository } from "./professionalTemporaryWorks.repository";
import type {
  GeneralReserveDecisionRecord,
  ProfessionalGeneralReserveRepository,
} from "@/domain/professional-estimates/professional-general-reserve.repository";

function mapRow(
  row: typeof professionalGeneralReserveDecisions.$inferSelect,
): GeneralReserveDecisionRecord {
  return {
    id: row.id, organizationId: row.organizationId,
    generalEstimateId: row.generalEstimateId, sourceId: row.sourceId,
    applicabilityDecisionId: row.applicabilityDecisionId,
    category: row.category as GeneralReserveDecisionRecord["category"],
    basisNote: row.basisNote, updatedAt: row.updatedAt,
  };
}

export class DrizzleProfessionalGeneralReserveRepository implements ProfessionalGeneralReserveRepository {
  private readonly governance = new DrizzleProfessionalTemporaryWorksRepository();

  getGeneralEstimate(org: string, id: string) {
    return this.governance.getGeneralEstimate(org, id);
  }
  findSourceByIdentity(org: string, code: string, edition: string) {
    return this.governance.findSourceByIdentity(org, code, edition);
  }
  getSource(org: string, sourceId: string) {
    return this.governance.getSource(org, sourceId);
  }
  listApplicabilityDecisions(org: string, sourceId: string) {
    return this.governance.listApplicabilityDecisions(org, sourceId);
  }
  getApplicabilityDecision(org: string, sourceId: string, decisionId: string) {
    return this.governance.getApplicabilityDecision(org, sourceId, decisionId);
  }

  async getDecision(org: string, generalEstimateId: string) {
    const [row] = await db.select().from(professionalGeneralReserveDecisions)
      .where(and(
        eq(professionalGeneralReserveDecisions.organizationId, org),
        eq(professionalGeneralReserveDecisions.generalEstimateId, generalEstimateId),
      )).limit(1);
    return row ? mapRow(row) : null;
  }

  async saveDecision(
    org: string, generalEstimateId: string,
    input: Pick<GeneralReserveDecisionRecord,
      "sourceId" | "applicabilityDecisionId" | "category" | "basisNote">,
  ) {
    const [row] = await db.insert(professionalGeneralReserveDecisions)
      .values({ organizationId: org, generalEstimateId, ...input })
      .onConflictDoUpdate({
        target: [
          professionalGeneralReserveDecisions.organizationId,
          professionalGeneralReserveDecisions.generalEstimateId,
        ],
        set: { ...input, updatedAt: new Date() },
      }).returning();
    if (!row) throw new Error("Decizia rezervei nu a putut fi salvată.");
    return mapRow(row);
  }
}
