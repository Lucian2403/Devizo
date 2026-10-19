import type {
  EstimatePerspective,
  ProfessionalRuleOrigin,
  ProfessionalWorkKind,
  RuleCalculationBasis,
  RuleValueType,
} from "./calculation";
import type { ProfessionalCostStackComponent } from "./calculation";

export const COMPANY_CALCULATION_RULE_SOURCE_IDENTITY = {
  code: "DEVIZO-COMPANY-CALC-RULES",
  edition: "1",
  title: "Reguli interne de calcul ale companiei",
  sourceType: "company_custom",
  jurisdiction: "MD",
  status: "active",
  officialStatus: "unknown",
  monitoringEnabled: false,
} as const;

/**
 * A persisted reusable professional rule definition (M8.3D). The row id becomes
 * the M8.3C `candidateId` when mapped to a `ProfessionalRuleCandidate`. Decimal
 * values stay as strings throughout the domain layer.
 */
export interface ProfessionalRuleDefinitionRecord {
  id: string;
  organizationId: string;
  sourceId: string;
  applicabilityDecisionId: string | null;
  name: string;
  component: ProfessionalCostStackComponent;
  valueType: RuleValueType;
  value: string;
  currency: string | null;
  calculationBasis: RuleCalculationBasis;
  validFrom: string;
  validTo: string | null;
  estimatePerspective: EstimatePerspective | "any";
  workKind: ProfessionalWorkKind | "any";
  ruleOrigin: ProfessionalRuleOrigin;
  procurementCategory: string | null;
  sourceReference: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProfessionalRuleDefinitionInput {
  organizationId: string;
  sourceId: string;
  applicabilityDecisionId?: string | null;
  name: string;
  component: ProfessionalCostStackComponent;
  valueType: RuleValueType;
  value: string;
  currency?: string | null;
  calculationBasis: RuleCalculationBasis;
  validFrom: string;
  validTo?: string | null;
  estimatePerspective: EstimatePerspective | "any";
  workKind: ProfessionalWorkKind | "any";
  ruleOrigin: ProfessionalRuleOrigin;
  procurementCategory?: string | null;
  sourceReference?: string | null;
  notes?: string | null;
}

export interface ApplicabilityDecisionForRule {
  id: string;
  sourceId: string;
  decision: string;
  applicableFrom: string | null;
  applicableUntil: string | null;
}

export interface CompanyCalculationRuleSourceRecord {
  id: string;
  organizationId: string;
  code: string;
  edition: string;
  title: string;
  sourceType: string;
  jurisdiction: string;
  status: string;
  officialStatus: string;
  monitoringEnabled: boolean;
}

export interface ProfessionalRuleDefinitionRepository {
  getCompanyCalculationRuleSource(
    organizationId: string,
  ): Promise<CompanyCalculationRuleSourceRecord | null>;

  insertCompanyCalculationRuleSourceIfAbsent(
    organizationId: string,
  ): Promise<CompanyCalculationRuleSourceRecord | null>;

  createRuleDefinition(
    input: CreateProfessionalRuleDefinitionInput,
  ): Promise<ProfessionalRuleDefinitionRecord>;

  getRuleDefinition(
    organizationId: string,
    id: string,
  ): Promise<ProfessionalRuleDefinitionRecord | null>;

  listRuleDefinitionsForComponent(
    organizationId: string,
    component: ProfessionalCostStackComponent,
  ): Promise<ProfessionalRuleDefinitionRecord[]>;

  listRuleDefinitions(
    organizationId: string,
  ): Promise<ProfessionalRuleDefinitionRecord[]>;

  listRuleDefinitionsForSource(
    organizationId: string,
    sourceId: string,
  ): Promise<ProfessionalRuleDefinitionRecord[]>;

  /**
   * Loads the applicability decision linked to an official rule definition,
   * scoped to the same organization and source. Returns null when no such
   * decision exists for that source (which the service treats as a provenance
   * failure for official origins).
   */
  getApplicabilityDecisionForSource(
    organizationId: string,
    sourceId: string,
    applicabilityDecisionId: string,
  ): Promise<ApplicabilityDecisionForRule | null>;
}
