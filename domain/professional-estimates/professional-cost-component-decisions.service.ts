import {
  resolveProfessionalRule,
  type EstimatePerspective,
  type ProfessionalWorkKind,
} from "./calculation";
import { ProfessionalRuleDefinitionService } from "./professional-rule-definitions.service";
import type {
  PersistedCostComponent,
  ProfessionalCostComponentDecisionRecord,
  ProfessionalCostComponentDecisionRepository,
} from "./professional-cost-component-decisions.repository";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPONENTS: readonly PersistedCostComponent[] = [
  "labor_contributions",
  "material_transport",
  "overhead",
  "estimated_profit",
];

export class ProfessionalCostComponentDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionalCostComponentDecisionError";
  }
}

export function isStoredCostComponentDecisionStale(
  decision: {
    decision: "applied" | "not_applicable";
    professionalRuleDefinitionId: string | null;
  } | null | undefined,
  currentlyEligibleRuleIds: readonly string[],
): boolean {
  return (
    decision?.decision === "applied" &&
    (decision.professionalRuleDefinitionId === null ||
      !currentlyEligibleRuleIds.includes(decision.professionalRuleDefinitionId))
  );
}

export interface SaveCostComponentDecisionInput {
  component: PersistedCostComponent;
  decision: "applied" | "not_applicable";
  professionalRuleDefinitionId?: string | null;
  reason?: string | null;
}

export interface CostComponentResolutionContext {
  valuationDate: string;
  currency: string;
  estimatePerspective: EstimatePerspective | null;
  workKind: ProfessionalWorkKind | null;
}

function requireUuid(value: string, label: string): void {
  if (!UUID.test(value)) {
    throw new ProfessionalCostComponentDecisionError(`${label} nu este validă.`);
  }
}

export class ProfessionalCostComponentDecisionService {
  constructor(
    private readonly repository: ProfessionalCostComponentDecisionRepository,
    private readonly ruleDefinitions: ProfessionalRuleDefinitionService,
  ) {}

  async listForContext(
    organizationId: string,
    calculationContextId: string,
  ): Promise<ProfessionalCostComponentDecisionRecord[]> {
    requireUuid(organizationId, "Compania");
    requireUuid(calculationContextId, "Contextul de calcul");
    return this.repository.listForContext(organizationId, calculationContextId);
  }

  async saveDecision(
    organizationId: string,
    calculationContextId: string,
    context: CostComponentResolutionContext,
    input: SaveCostComponentDecisionInput,
  ): Promise<ProfessionalCostComponentDecisionRecord> {
    requireUuid(organizationId, "Compania");
    requireUuid(calculationContextId, "Contextul de calcul");
    if (!COMPONENTS.includes(input.component)) {
      throw new ProfessionalCostComponentDecisionError(
        "Componenta selectată nu poate primi o decizie în acest pas.",
      );
    }

    let professionalRuleDefinitionId: string | null = null;
    let reason: string | null = null;
    if (input.decision === "applied") {
      if (
        typeof input.professionalRuleDefinitionId !== "string" ||
        !UUID.test(input.professionalRuleDefinitionId)
      ) {
        throw new ProfessionalCostComponentDecisionError(
          "Selectați o regulă eligibilă pentru aplicare.",
        );
      }
      if (
        !context.estimatePerspective ||
        !context.workKind ||
        !/^\d{4}-\d{2}-\d{2}$/.test(context.valuationDate)
      ) {
        throw new ProfessionalCostComponentDecisionError(
          "Completați data evaluării, perspectiva și tipul lucrărilor înainte de a aplica o regulă.",
        );
      }
      const candidates =
        await this.ruleDefinitions.loadCandidatesForComponent(
          organizationId,
          input.component,
        );
      const resolution = resolveProfessionalRule(input.component, candidates, {
        valuationDate: context.valuationDate,
        estimatePerspective: context.estimatePerspective,
        workKind: context.workKind,
        currency: context.currency,
      });
      const chosen = resolution.eligibleCandidates.find(
        (candidate) =>
          candidate.candidateId === input.professionalRuleDefinitionId,
      );
      if (!chosen) {
        throw new ProfessionalCostComponentDecisionError(
          "Regula selectată nu este eligibilă pentru contextul curent.",
        );
      }
      professionalRuleDefinitionId = chosen.candidateId;
    } else if (input.decision === "not_applicable") {
      if (
        input.professionalRuleDefinitionId != null ||
        typeof input.reason !== "string" ||
        input.reason.trim() === ""
      ) {
        throw new ProfessionalCostComponentDecisionError(
          "Introduceți un motiv și nu selectați o regulă pentru a marca componenta ca neaplicabilă.",
        );
      }
      reason = input.reason;
    } else {
      throw new ProfessionalCostComponentDecisionError(
        "Decizia selectată nu este validă.",
      );
    }

    return this.repository.upsert({
      organizationId,
      calculationContextId,
      component: input.component,
      decision: input.decision,
      professionalRuleDefinitionId,
      reason,
    });
  }
}
