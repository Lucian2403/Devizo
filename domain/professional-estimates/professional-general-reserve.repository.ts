import type { GeneralReserveCategory } from "./calculation";
import type {
  ProfessionalGeneralEstimateContextRecord,
  TemporaryWorksApplicabilityDecision,
  TemporaryWorksNormativeSource,
} from "./professional-temporary-works.repository";

export interface GeneralReserveDecisionRecord {
  id: string;
  organizationId: string;
  generalEstimateId: string;
  sourceId: string;
  applicabilityDecisionId: string;
  category: GeneralReserveCategory;
  basisNote: string;
  updatedAt: Date;
}

export interface ProfessionalGeneralReserveRepository {
  getGeneralEstimate(
    organizationId: string, generalEstimateId: string,
  ): Promise<ProfessionalGeneralEstimateContextRecord | null>;
  findSourceByIdentity(
    organizationId: string, code: string, edition: string,
  ): Promise<TemporaryWorksNormativeSource | null>;
  getSource(
    organizationId: string, sourceId: string,
  ): Promise<TemporaryWorksNormativeSource | null>;
  listApplicabilityDecisions(
    organizationId: string, sourceId: string,
  ): Promise<TemporaryWorksApplicabilityDecision[]>;
  getApplicabilityDecision(
    organizationId: string, sourceId: string, decisionId: string,
  ): Promise<TemporaryWorksApplicabilityDecision | null>;
  getDecision(
    organizationId: string, generalEstimateId: string,
  ): Promise<GeneralReserveDecisionRecord | null>;
  saveDecision(
    organizationId: string, generalEstimateId: string,
    input: Pick<GeneralReserveDecisionRecord,
      "sourceId" | "applicabilityDecisionId" | "category" | "basisNote">,
  ): Promise<GeneralReserveDecisionRecord>;
}
