import type { ProfessionalCostStackComponent } from "./calculation";

export type PersistedCostComponent = Exclude<
  ProfessionalCostStackComponent,
  "procurement_storage"
>;
export type PersistedCostComponentDecision = "applied" | "not_applicable";

export interface ProfessionalCostComponentDecisionRecord {
  id: string;
  organizationId: string;
  calculationContextId: string;
  component: PersistedCostComponent;
  decision: PersistedCostComponentDecision;
  professionalRuleDefinitionId: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertProfessionalCostComponentDecisionInput {
  organizationId: string;
  calculationContextId: string;
  component: PersistedCostComponent;
  decision: PersistedCostComponentDecision;
  professionalRuleDefinitionId: string | null;
  reason: string | null;
}

export interface ProfessionalCostComponentDecisionRepository {
  listForContext(
    organizationId: string,
    calculationContextId: string,
  ): Promise<ProfessionalCostComponentDecisionRecord[]>;
  upsert(
    input: UpsertProfessionalCostComponentDecisionInput,
  ): Promise<ProfessionalCostComponentDecisionRecord>;
}
