import {
  Decimal,
  parseDecimal,
  toDecimalString,
  type DecimalValue,
} from "./decimal";

export const PROFESSIONAL_OBJECT_ESTIMATE_COST_CATEGORIES = [
  "construction_works",
  "installation_works",
  "equipment_furniture_inventory",
  "other_costs",
] as const;

export type ProfessionalObjectEstimateCostCategory =
  (typeof PROFESSIONAL_OBJECT_ESTIMATE_COST_CATEGORIES)[number];

export interface ProfessionalObjectEstimateAggregationEntry {
  calculationContextId: string;
  costCategory: ProfessionalObjectEstimateCostCategory;
  amount: string;
  currency: string;
}

export interface ProfessionalObjectEstimateTotals {
  currency: string;
  constructionWorks: string;
  installationWorks: string;
  equipmentFurnitureInventory: string;
  otherCosts: string;
  total: string;
}

export class ProfessionalObjectEstimateAggregationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionalObjectEstimateAggregationError";
  }
}

export function calculateProfessionalObjectEstimate(
  entries: readonly ProfessionalObjectEstimateAggregationEntry[],
): ProfessionalObjectEstimateTotals {
  const [first] = entries;
  if (!first) {
    throw new ProfessionalObjectEstimateAggregationError(
      "An object estimate requires at least one included local estimate.",
    );
  }

  const totals: Record<ProfessionalObjectEstimateCostCategory, DecimalValue> = {
    construction_works: new Decimal(0),
    installation_works: new Decimal(0),
    equipment_furniture_inventory: new Decimal(0),
    other_costs: new Decimal(0),
  };
  const seenCalculationContexts = new Set<string>();

  for (const entry of entries) {
    if (
      !PROFESSIONAL_OBJECT_ESTIMATE_COST_CATEGORIES.includes(entry.costCategory)
    ) {
      throw new ProfessionalObjectEstimateAggregationError(
        "Every included local estimate requires an explicit cost category.",
      );
    }
    if (entry.currency !== first.currency) {
      throw new ProfessionalObjectEstimateAggregationError(
        "Local estimates with different currencies cannot be aggregated.",
      );
    }
    if (seenCalculationContexts.has(entry.calculationContextId)) {
      throw new ProfessionalObjectEstimateAggregationError(
        "A local estimate can appear only once in an object estimate.",
      );
    }
    seenCalculationContexts.add(entry.calculationContextId);

    try {
      totals[entry.costCategory] = totals[entry.costCategory].plus(
        parseDecimal(entry.amount, "amount"),
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new ProfessionalObjectEstimateAggregationError(error.message);
      }
      throw error;
    }
  }

  const categoryTotals = {
    constructionWorks: toDecimalString(totals.construction_works),
    installationWorks: toDecimalString(totals.installation_works),
    equipmentFurnitureInventory: toDecimalString(
      totals.equipment_furniture_inventory,
    ),
    otherCosts: toDecimalString(totals.other_costs),
  };
  return {
    currency: first.currency,
    ...categoryTotals,
    total: toDecimalString(
      totals.construction_works
        .plus(totals.installation_works)
        .plus(totals.equipment_furniture_inventory)
        .plus(totals.other_costs),
    ),
  };
}
