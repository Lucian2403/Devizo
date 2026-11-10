import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { professionalSdncDecisions } from "@/infrastructure/db/schema";
import { DrizzleProfessionalTemporaryWorksRepository } from "./professionalTemporaryWorks.repository";
import type {
  ProfessionalSdncRepository,
  SaveSdncDecisionInput,
  SdncDecisionRecord,
} from "@/domain/professional-estimates/professional-sdnc.repository";

function mapRow(row: typeof professionalSdncDecisions.$inferSelect): SdncDecisionRecord {
  return {
    id: row.id, organizationId: row.organizationId,
    generalEstimateId: row.generalEstimateId,
    fiscalYear: row.fiscalYear, legalVersion: row.legalVersion,
    mode: row.mode as SdncDecisionRecord["mode"],
    workKind: row.workKind as SdncDecisionRecord["workKind"],
    permitConfirmed: row.permitConfirmed,
    nonPublicFundingConfirmed: row.nonPublicFundingConfirmed,
    notExemptHouseConfirmed: row.notExemptHouseConfirmed,
    annualEligibleInvestmentMdl: row.annualEligibleInvestmentMdl,
    supportingDocument: row.supportingDocument,
    exclusionReason: row.exclusionReason as SdncDecisionRecord["exclusionReason"],
    basisNote: row.basisNote, updatedAt: row.updatedAt,
  };
}

export class DrizzleProfessionalSdncRepository implements ProfessionalSdncRepository {
  private readonly general = new DrizzleProfessionalTemporaryWorksRepository();

  getGeneralEstimate(org: string, id: string) {
    return this.general.getGeneralEstimate(org, id);
  }

  async getDecision(org: string, generalEstimateId: string) {
    const [row] = await db.select().from(professionalSdncDecisions).where(and(
      eq(professionalSdncDecisions.organizationId, org),
      eq(professionalSdncDecisions.generalEstimateId, generalEstimateId),
    )).limit(1);
    return row ? mapRow(row) : null;
  }

  async saveDecision(org: string, generalEstimateId: string, input: SaveSdncDecisionInput) {
    const [row] = await db.insert(professionalSdncDecisions)
      .values({ organizationId: org, generalEstimateId, ...input })
      .onConflictDoUpdate({
        target: [
          professionalSdncDecisions.organizationId,
          professionalSdncDecisions.generalEstimateId,
        ],
        set: { ...input, updatedAt: new Date() },
      }).returning();
    if (!row) throw new Error("Nu s-a putut salva decizia SDNC.");
    return mapRow(row);
  }
}
