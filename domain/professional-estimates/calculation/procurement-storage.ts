import {
  resolveProfessionalRule,
  type ProfessionalRuleCandidate,
  type ProfessionalRuleResolutionContext,
  type ProfessionalRuleResolutionResult,
} from "./rule-resolution";
import { Decimal, parseDecimal, toDecimalString } from "./decimal";
import type { NormativeCalculationContext, ProcurementCategory } from "../procurement-semantics";
import type { DirectResourceCostPresentation, PricedResourceLine } from "../professional-resource-prices.service";

export interface ProcurementMaterialProvenance {
  workQuantityItemId: string;
  resourceConsumptionId: string;
  resourceId: string;
  resourcePriceId: string;
  resourceCost: string;
}

export interface ProcurementApplication {
  professionalRuleDefinitionId: string;
  sourceId: string | null;
  applicabilityDecisionId: string | null;
  sourceReference: string | null;
  ruleOrigin: ProfessionalRuleCandidate["ruleOrigin"];
  ratePercent: string;
  ruleValidFrom: string;
  ruleValidTo: string | null;
  procurementCategory: ProcurementCategory;
  materialBase: string;
  amount: string;
  valuationDate: string;
  estimatePerspective: ProfessionalRuleResolutionContext["estimatePerspective"];
  workKind: ProfessionalRuleResolutionContext["workKind"];
  currency: string;
  materials: ProcurementMaterialProvenance[];
}

export interface ProcurementCategoryResult {
  category: ProcurementCategory;
  materialBase: string;
  resolution: ProfessionalRuleResolutionResult;
  application: ProcurementApplication | null;
}

export interface ProcurementBlock {
  workQuantityItemId: string;
  resourceId: string | null;
  resourceName: string;
  procurementCategory: ProcurementCategory | null;
  reason: "empty_composition" | "direct_price" | "category" | "price_semantics";
}

export interface ProcurementStorageResult {
  contextComplete: boolean;
  complete: boolean;
  categories: ProcurementCategoryResult[];
  blocks: ProcurementBlock[];
  procurementStorageTotal: string | null;
  directResourceTotal: string | null;
  directPlusProcurement: string | null;
}

function nonnegative(value: string, field: string) {
  const decimal = parseDecimal(value, field);
  if (decimal.lt(0)) throw new Error(`${field} must not be negative.`);
  return decimal;
}

export function calculateProcurementStorageAmount(
  materialBase: string,
  ratePercent: string,
): string {
  return toDecimalString(
    nonnegative(materialBase, "materialBase")
      .times(nonnegative(ratePercent, "ratePercent")).dividedBy("100"),
  );
}

function materialBlock(resource: PricedResourceLine): ProcurementBlock["reason"] | null {
  if (!resource.procurementCategory) return "category";
  if (resource.priceStatus !== "selected" || !resource.calculation || !resource.selectedPrice) {
    return "direct_price";
  }
  if (
    resource.selectedPrice.vatTreatment !== "exclusive" ||
    resource.selectedPrice.transportTreatment !== "excluded"
  ) return "price_semantics";
  return null;
}

/**
 * Only confirmed material bases enter category-specific rule resolution.
 * This is not a cost-stack application and does not produce a final estimate.
 */
export function calculateProcurementStorage(
  direct: DirectResourceCostPresentation,
  context: NormativeCalculationContext & { valuationDate: string; currency: string },
  candidates: readonly ProfessionalRuleCandidate[],
): ProcurementStorageResult {
  const blocks: ProcurementBlock[] = [];
  const groups = new Map<ProcurementCategory, {
    base: InstanceType<typeof Decimal>;
    materials: ProcurementMaterialProvenance[];
  }>();
  let directTotal = new Decimal("0");
  const positions = Object.values(direct.positionsByWorkItemId);
  let directComplete = positions.length > 0;
  for (const position of positions) {
    if (!position.complete || position.directResourceTotal === null) {
      directComplete = false;
    } else {
      directTotal = directTotal.plus(parseDecimal(position.directResourceTotal, "directResourceTotal"));
    }
    if (position.resources.length === 0) {
      blocks.push({
        workQuantityItemId: position.workQuantityItemId,
        resourceId: null, resourceName: "",
        procurementCategory: null,
        reason: "empty_composition",
      });
    }
    for (const resource of position.resources) {
      if (resource.resourceType !== "material" || parseDecimal(resource.resourceQuantity, "resourceQuantity").isZero()) {
        continue;
      }
      const reason = materialBlock(resource);
      if (reason) {
        blocks.push({
          workQuantityItemId: position.workQuantityItemId,
          resourceId: resource.resourceId, resourceName: resource.name, reason,
          procurementCategory: resource.procurementCategory,
        });
        continue;
      }
      const { calculation, selectedPrice, procurementCategory } = resource;
      if (!calculation || !selectedPrice || !procurementCategory) {
        throw new Error("Confirmed material base is missing its provenance.");
      }
      if (calculation.currency !== context.currency || selectedPrice.currency !== context.currency) {
        blocks.push({
          workQuantityItemId: position.workQuantityItemId,
          resourceId: resource.resourceId, resourceName: resource.name,
          procurementCategory,
          reason: "direct_price",
        });
        continue;
      }
      const group = groups.get(procurementCategory) ?? { base: new Decimal("0"), materials: [] };
      group.base = group.base.plus(nonnegative(calculation.resourceCost, "resourceCost"));
      group.materials.push({
        workQuantityItemId: position.workQuantityItemId,
        resourceConsumptionId: calculation.resourceConsumptionId,
        resourceId: resource.resourceId, resourcePriceId: selectedPrice.id,
        resourceCost: calculation.resourceCost,
      });
      groups.set(procurementCategory, group);
    }
  }

  const categories: ProcurementCategoryResult[] = [];
  const contextComplete = context.estimatePerspective !== null && context.workKind !== null;
  if (context.estimatePerspective !== null && context.workKind !== null) {
    for (const [category, group] of groups) {
      const resolutionContext: ProfessionalRuleResolutionContext = {
        valuationDate: context.valuationDate,
        currency: context.currency,
        estimatePerspective: context.estimatePerspective,
        workKind: context.workKind,
        procurementStorageCategory: category,
      };
      const resolution = resolveProfessionalRule("procurement_storage", candidates, resolutionContext);
      const selected = resolution.candidate;
      const materialBase = toDecimalString(group.base);
      const categoryBlocked = blocks.some((block) => block.procurementCategory === category);
      const application: ProcurementApplication | null = selected && !categoryBlocked ? {
        professionalRuleDefinitionId: selected.candidateId,
        sourceId: selected.sourceId ?? null,
        applicabilityDecisionId: selected.applicabilityDecisionId ?? null,
        sourceReference: selected.sourceReference ?? null,
        ruleOrigin: selected.ruleOrigin,
        ratePercent: selected.value,
        ruleValidFrom: selected.validFrom,
        ruleValidTo: selected.validTo,
        procurementCategory: category,
        materialBase,
        amount: calculateProcurementStorageAmount(materialBase, selected.value),
        valuationDate: context.valuationDate,
        estimatePerspective: context.estimatePerspective,
        workKind: context.workKind,
        currency: context.currency,
        materials: group.materials,
      } : null;
      categories.push({ category, materialBase, resolution, application });
    }
  }
  const complete = contextComplete && directComplete && blocks.length === 0 &&
    categories.every((entry) => entry.application !== null);
  const procurementTotal = categories.reduce(
    (sum, entry) => entry.application ? sum.plus(entry.application.amount) : sum,
    new Decimal("0"),
  );
  return {
    contextComplete, complete, categories, blocks,
    procurementStorageTotal: complete ? toDecimalString(procurementTotal) : null,
    directResourceTotal: directComplete ? toDecimalString(directTotal) : null,
    directPlusProcurement: complete ? toDecimalString(directTotal.plus(procurementTotal)) : null,
  };
}
