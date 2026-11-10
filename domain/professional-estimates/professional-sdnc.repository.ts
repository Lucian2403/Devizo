export type SdncDecisionMode = "liable" | "not_liable";
export type SdncWorkKind = "new_construction" | "existing_intervention";
export type SdncExclusionReason =
  | "public_budget"
  | "no_building_permit"
  | "personal_individual_house"
  | "outside_eligible_works";

export interface SdncDecisionRecord {
  id: string;
  organizationId: string;
  generalEstimateId: string;
  fiscalYear: number;
  legalVersion: string;
  mode: SdncDecisionMode;
  workKind: SdncWorkKind | null;
  permitConfirmed: boolean;
  nonPublicFundingConfirmed: boolean;
  notExemptHouseConfirmed: boolean;
  annualEligibleInvestmentMdl: string | null;
  supportingDocument: string | null;
  exclusionReason: SdncExclusionReason | null;
  basisNote: string;
  updatedAt: Date;
}

export type SaveSdncDecisionInput = Omit<
  SdncDecisionRecord,
  "id" | "organizationId" | "generalEstimateId" | "updatedAt"
>;

export interface ProfessionalSdncRepository {
  getGeneralEstimate(
    org: string, generalEstimateId: string,
  ): Promise<{ id: string; organizationId: string; valuationDate: string; currency: string } | null>;
  getDecision(org: string, generalEstimateId: string): Promise<SdncDecisionRecord | null>;
  saveDecision(org: string, generalEstimateId: string, input: SaveSdncDecisionInput): Promise<SdncDecisionRecord>;
}
