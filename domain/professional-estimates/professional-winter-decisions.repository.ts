import type { ProfessionalGeneralEstimateContextRecord } from "./professional-temporary-works.repository";

export type WinterBuildingScope = "residential_administrative" | "other";
export type WinterClassification = "listed" | "analogous";

export interface WinterDecisionRecord {
  id: string;
  organizationId: string;
  generalEstimateId: string;
  mode: "normative_rate" | "not_applicable";
  ruleDefinitionId: string | null;
  periodKind: "annual_average" | "short_project" | null;
  startDate: string | null;
  endDate: string | null;
  winterDays: number | null;
  projectReference: string | null;
  buildingScope: WinterBuildingScope | null;
  principalWorkConfirmed: boolean;
  classification: WinterClassification | null;
  analogyReference: string | null;
  exclusionReason: "heated_current_repair" | null;
  updatedAt: Date;
}

export type SaveWinterDecisionInput =
  | { mode: "not_applicable"; exclusionReason: "heated_current_repair" }
  | {
      mode: "normative_rate";
      ruleDefinitionId: string;
      buildingScope: WinterBuildingScope;
      principalWorkConfirmed: boolean;
      classification: WinterClassification;
      analogyReference: string | null;
      period:
        | { kind: "annual_average" }
        | {
            kind: "short_project";
            startDate: string;
            endDate: string;
            winterDays: string;
            projectReference: string;
          };
    };

export interface PersistedWinterDecisionInput extends Omit<WinterDecisionRecord, "id" | "organizationId" | "generalEstimateId" | "updatedAt"> {}

export interface ProfessionalWinterDecisionsRepository {
  getGeneralEstimate(
    organizationId: string, generalEstimateId: string,
  ): Promise<ProfessionalGeneralEstimateContextRecord | null>;
  getDecision(
    organizationId: string, generalEstimateId: string,
  ): Promise<WinterDecisionRecord | null>;
  saveDecision(
    organizationId: string, generalEstimateId: string,
    input: PersistedWinterDecisionInput,
  ): Promise<WinterDecisionRecord>;
}
