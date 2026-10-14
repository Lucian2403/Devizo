import {
  calculateProfessionalCostStack,
  calculateResources,
  DecimalParseError,
  parseDecimal,
  resolveProfessionalRule,
  toDecimalString,
  type ProfessionalCostStackInput,
  type ProfessionalRuleCandidate,
} from "./calculation";
import {
  CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
  CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
} from "./official-rule-packs/cp-l-01-07-2012";
import type { ProfessionalRuleDefinitionService } from "./professional-rule-definitions.service";

export const CP_L_01_07_PREVIEW_CATEGORIES = [
  CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
  CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
] as const;

export type CpL0107PreviewCategory =
  (typeof CP_L_01_07_PREVIEW_CATEGORIES)[number];

export class CpL0107PreviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CpL0107PreviewValidationError";
  }
}

export interface CpL0107PreviewInput {
  organizationId: string;
  sourceId: string;
  valuationDate: string;
  category: string;
  materialBase: string;
}

export type CpL0107PreviewResult =
  | {
      status: "missing" | "ambiguous";
      candidateIds: string[];
    }
  | {
      status: "selected";
      materialBase: string;
      category: CpL0107PreviewCategory;
      candidateId: string;
      applicabilityDecisionId: string | null;
      sourceReference: string | null;
      ratePercent: string;
      procurementStorage: string;
      directCost: string;
    };

const notApplicable = (reason: string) => ({
  status: "not_applicable" as const,
  reason,
});

function isPreviewCategory(
  value: string,
): value is CpL0107PreviewCategory {
  return (CP_L_01_07_PREVIEW_CATEGORIES as readonly string[]).includes(value);
}

function costStackInput(
  resourceCalculation: ReturnType<typeof calculateResources>,
  candidate: ProfessionalRuleCandidate,
): ProfessionalCostStackInput {
  return {
    resourceCalculation,
    laborContributions: notApplicable("No labor in this material-only preview."),
    materialTransport: notApplicable("Delivery transport is excluded from the input."),
    procurementStorage: {
      status: "applied",
      ratePercent: candidate.value,
      rule: {
        ruleType: candidate.ruleOrigin,
        calculationRuleId: candidate.calculationRuleId ?? null,
        sourceId: candidate.sourceId ?? null,
        sourceReference: candidate.sourceReference ?? null,
      },
    },
    overhead: notApplicable("Overhead is outside this technical preview."),
    estimatedProfit: notApplicable("Estimated profit is outside this technical preview."),
  };
}

export async function calculateCpL0107Preview(
  service: Pick<ProfessionalRuleDefinitionService, "loadCandidatesForComponent">,
  input: CpL0107PreviewInput,
): Promise<CpL0107PreviewResult> {
  if (!isPreviewCategory(input.category)) {
    throw new CpL0107PreviewValidationError("Select one of the supported material categories.");
  }

  let materialBase;
  try {
    materialBase = parseDecimal(input.materialBase, "materialBase");
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new CpL0107PreviewValidationError(
        "Introduceți o bază materială numerică validă.",
      );
    }
    throw error;
  }
  if (materialBase.lessThan(0)) {
    throw new CpL0107PreviewValidationError(
      "Baza materialelor nu poate fi negativă.",
    );
  }
  const normalizedMaterialBase = toDecimalString(materialBase);

  const candidates = await service.loadCandidatesForComponent(
    input.organizationId,
    "procurement_storage",
  );
  const resolution = resolveProfessionalRule(
    "procurement_storage",
    candidates.filter((candidate) => candidate.sourceId === input.sourceId),
    {
      valuationDate: input.valuationDate,
      estimatePerspective: "investor",
      workKind: "construction",
      currency: "MDL",
      procurementStorageCategory: input.category,
    },
  );

  if (resolution.status === "missing" || resolution.status === "ambiguous") {
    return {
      status: resolution.status,
      candidateIds: resolution.eligibleCandidates.map(
        (candidate) => candidate.candidateId,
      ),
    };
  }
  const candidate = resolution.candidate;
  if (candidate == null) {
    throw new Error("Rule resolver returned selected without a candidate.");
  }

  const resourceCalculation = calculateResources([
    {
      estimateNormVersionId: "manual-verification-fixture",
      resourceConsumptionId: "manual-verification-fixture",
      resourceId: "manual-vat-exclusive-material-base",
      resourcePriceId: "manual-vat-exclusive-material-base",
      normApplicationId: null,
      resourceType: "material",
      currency: "MDL",
      workQuantity: "1",
      normBasisQuantity: "1",
      normativeConsumption: "1",
      applicationCoefficient: "1",
      resourcePrice: normalizedMaterialBase,
      priceBasisQuantity: "1",
    },
  ]);
  const result = calculateProfessionalCostStack(
    costStackInput(resourceCalculation, candidate),
  );

  return {
    status: "selected",
    materialBase: normalizedMaterialBase,
    category: input.category,
    candidateId: candidate.candidateId,
    applicabilityDecisionId: candidate.applicabilityDecisionId ?? null,
    sourceReference: candidate.sourceReference ?? null,
    ratePercent: candidate.value,
    procurementStorage: result.procurementStorage,
    directCost: result.directCost,
  };
}
