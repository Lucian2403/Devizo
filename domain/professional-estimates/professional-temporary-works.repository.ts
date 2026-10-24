import type { ProfessionalGeneralEstimateTotals } from "./calculation";
import type {
  TemporaryWorksProjectCondition,
} from "./calculation";

export const PROFESSIONAL_GENERAL_COST_COMPONENT = "temporary_works" as const;

export type ProfessionalGeneralCostMode =
  | "normative_rate"
  | "project_calculation";

export interface TemporaryWorksNormativeSource {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  edition: string;
  sourceType: string;
  jurisdiction: string;
  status: string;
  officialStatus: string;
  effectiveDate: string | null;
  validFrom: string | null;
  validTo: string | null;
  sourceUri: string | null;
}

export interface TemporaryWorksApplicabilityDecision {
  id: string;
  organizationId: string;
  sourceId: string;
  revision: number;
  decision: string;
  applicableFrom: string | null;
  applicableUntil: string | null;
  officialStatus: string;
  sourceCode: string;
  sourceEdition: string;
  basisNote: string;
}

export interface ProfessionalGeneralRuleDefinitionRecord {
  id: string;
  organizationId: string;
  sourceId: string;
  applicabilityDecisionId: string;
  component: typeof PROFESSIONAL_GENERAL_COST_COMPONENT;
  ruleCode: string;
  groupCode: string;
  groupLabel: string;
  name: string;
  valueType: "percent";
  value: string;
  validFrom: string;
  validTo: string | null;
  sourceReference: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProfessionalGeneralRuleDefinitionInput {
  organizationId: string;
  sourceId: string;
  applicabilityDecisionId: string;
  component: typeof PROFESSIONAL_GENERAL_COST_COMPONENT;
  ruleCode: string;
  groupCode: string;
  groupLabel: string;
  name: string;
  valueType: "percent";
  value: string;
  validFrom: string;
  validTo: string | null;
  sourceReference: string;
}

export interface ProfessionalGeneralCostDecisionRecord {
  id: string;
  organizationId: string;
  generalEstimateId: string;
  component: typeof PROFESSIONAL_GENERAL_COST_COMPONENT;
  mode: ProfessionalGeneralCostMode;
  ruleDefinitionId: string | null;
  projectCondition: TemporaryWorksProjectCondition | null;
  projectConstructionAmount: string | null;
  projectInstallationAmount: string | null;
  projectReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SaveProfessionalGeneralCostDecisionInput =
  | {
      mode: "normative_rate";
      ruleDefinitionId: string;
      projectCondition: TemporaryWorksProjectCondition;
    }
  | {
      mode: "project_calculation";
      projectConstructionAmount: string;
      projectInstallationAmount: string;
      projectReference: string;
    };

export interface ProfessionalGeneralEstimateContextRecord {
  id: string;
  organizationId: string;
  valuationDate: string;
  currency: string;
}

export interface ProfessionalTemporaryWorksRepository {
  findSourceByIdentity(
    organizationId: string,
    code: string,
    edition: string,
  ): Promise<TemporaryWorksNormativeSource | null>;

  getSource(
    organizationId: string,
    sourceId: string,
  ): Promise<TemporaryWorksNormativeSource | null>;

  listApplicabilityDecisions(
    organizationId: string,
    sourceId: string,
  ): Promise<TemporaryWorksApplicabilityDecision[]>;

  getApplicabilityDecision(
    organizationId: string,
    sourceId: string,
    applicabilityDecisionId: string,
  ): Promise<TemporaryWorksApplicabilityDecision | null>;

  listRuleDefinitions(
    organizationId: string,
    sourceId: string,
  ): Promise<ProfessionalGeneralRuleDefinitionRecord[]>;

  createRuleDefinitions(
    rows: readonly CreateProfessionalGeneralRuleDefinitionInput[],
  ): Promise<ProfessionalGeneralRuleDefinitionRecord[]>;

  rebindRuleDefinitionsApplicability(
    organizationId: string,
    sourceId: string,
    ruleDefinitionIds: readonly string[],
    applicabilityDecisionId: string,
  ): Promise<ProfessionalGeneralRuleDefinitionRecord[]>;

  getRuleDefinition(
    organizationId: string,
    ruleDefinitionId: string,
  ): Promise<ProfessionalGeneralRuleDefinitionRecord | null>;

  getGeneralEstimate(
    organizationId: string,
    generalEstimateId: string,
  ): Promise<ProfessionalGeneralEstimateContextRecord | null>;

  getDecision(
    organizationId: string,
    generalEstimateId: string,
  ): Promise<ProfessionalGeneralCostDecisionRecord | null>;

  saveDecision(
    organizationId: string,
    generalEstimateId: string,
    input: SaveProfessionalGeneralCostDecisionInput,
  ): Promise<ProfessionalGeneralCostDecisionRecord>;
}

export interface TemporaryWorksGeneralEstimateInput {
  id: string;
  valuationDate: string;
  currency: string;
  complete: boolean;
  totals: ProfessionalGeneralEstimateTotals | null;
}
