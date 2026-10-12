import { PROFESSIONAL_RESOURCE_TYPES, type ProfessionalResourceType } from "../types";
import {
  Decimal,
  DecimalParseError,
  parseDecimal,
  toDecimalString,
  type DecimalValue,
} from "./decimal";

/**
 * Deterministic resource calculation kernel (M8.3A).
 *
 * This is the professional resource-method core only. It is intentionally
 * separate from the commercial quote pricing engine (`domain/quotes/pricing.ts`)
 * and never touches catalog items, selling prices or commercial quote prices.
 *
 * Formulas implemented:
 *
 *   resourceQuantity =
 *     workQuantity / normBasisQuantity
 *     × normativeConsumption
 *     × applicationCoefficient
 *
 *   effectiveUnitPrice =
 *     resourcePrice / priceBasisQuantity
 *
 *   resourceCost =
 *     resourceQuantity × effectiveUnitPrice
 *
 * The kernel is pure: it accepts explicit input objects and returns explicit
 * output objects. It performs no database access, no rounding to a money scale
 * and no VAT, overhead, profit, transport or other rule application. Those are
 * deliberately out of scope for M8.3A.
 */

export type ResourceCalculationErrorCode =
  | "non_decimal_value"
  | "norm_basis_not_positive"
  | "price_basis_not_positive"
  | "work_quantity_negative"
  | "normative_consumption_negative"
  | "resource_price_negative"
  | "application_coefficient_not_positive"
  | "invalid_resource_type"
  | "mixed_currency";

export class ResourceCalculationError extends Error {
  constructor(
    readonly code: ResourceCalculationErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ResourceCalculationError";
  }
}

/**
 * One resource line as it enters the kernel. Provenance identifiers are carried
 * through so a later professional calculation snapshot can reference the exact
 * records used; they are not part of the arithmetic. All quantities and prices
 * are decimal strings.
 */
export interface ResourceCalculationInput {
  estimateNormVersionId: string;
  resourceConsumptionId: string;
  resourceId: string;
  resourcePriceId: string;
  normApplicationId: string | null;

  resourceType: ProfessionalResourceType;
  currency: string;

  workQuantity: string;
  normBasisQuantity: string;
  normativeConsumption: string;
  applicationCoefficient: string;

  resourcePrice: string;
  priceBasisQuantity: string;
}

/**
 * One calculated resource line. Inputs are echoed alongside the derived values
 * so the result can be explained later without re-deriving it. All numbers are
 * canonical decimal strings; they are intentionally not rounded to 2 decimals.
 */
export interface ResourceCalculationLine {
  estimateNormVersionId: string;
  resourceConsumptionId: string;
  resourceId: string;
  resourcePriceId: string;
  normApplicationId: string | null;

  resourceType: ProfessionalResourceType;
  currency: string;

  workQuantity: string;
  normBasisQuantity: string;
  normativeConsumption: string;
  applicationCoefficient: string;
  resourcePrice: string;
  priceBasisQuantity: string;

  resourceQuantity: string;
  effectiveUnitPrice: string;
  resourceCost: string;
}

export type ResourceTypeTotals = Record<ProfessionalResourceType, string>;

export interface ResourceCalculationResult {
  /** The shared currency, or null when the calculation has no lines. */
  currency: string | null;
  lines: ResourceCalculationLine[];
  /** Deterministic sum of resourceCost grouped by resource type. */
  totalsByResourceType: ResourceTypeTotals;
  /** Deterministic sum of every resourceCost in the calculation. */
  directResourceTotal: string;
}

function parse(value: string, field: string): DecimalValue {
  try {
    return parseDecimal(value, field);
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new ResourceCalculationError(
        "non_decimal_value",
        error.message,
        field,
      );
    }
    throw error;
  }
}

/**
 * Calculates a single resource line deterministically.
 *
 * Validation (no silent correction):
 *   normBasisQuantity       must be > 0
 *   priceBasisQuantity      must be > 0
 *   applicationCoefficient  must be > 0
 *   workQuantity            must be >= 0
 *   normativeConsumption    must be >= 0
 *   resourcePrice           must be >= 0
 */
export function calculateResourceLine(
  input: ResourceCalculationInput,
): ResourceCalculationLine {
  if (!PROFESSIONAL_RESOURCE_TYPES.includes(input.resourceType)) {
    throw new ResourceCalculationError(
      "invalid_resource_type",
      `Unknown resource type: ${String(input.resourceType)}`,
      "resourceType",
    );
  }

  const workQuantity = parse(input.workQuantity, "workQuantity");
  const normBasisQuantity = parse(input.normBasisQuantity, "normBasisQuantity");
  const normativeConsumption = parse(
    input.normativeConsumption,
    "normativeConsumption",
  );
  const applicationCoefficient = parse(
    input.applicationCoefficient,
    "applicationCoefficient",
  );
  const resourcePrice = parse(input.resourcePrice, "resourcePrice");
  const priceBasisQuantity = parse(
    input.priceBasisQuantity,
    "priceBasisQuantity",
  );

  if (normBasisQuantity.lessThanOrEqualTo(0)) {
    throw new ResourceCalculationError(
      "norm_basis_not_positive",
      "normBasisQuantity must be greater than 0.",
      "normBasisQuantity",
    );
  }
  if (priceBasisQuantity.lessThanOrEqualTo(0)) {
    throw new ResourceCalculationError(
      "price_basis_not_positive",
      "priceBasisQuantity must be greater than 0.",
      "priceBasisQuantity",
    );
  }
  if (applicationCoefficient.lessThanOrEqualTo(0)) {
    throw new ResourceCalculationError(
      "application_coefficient_not_positive",
      "applicationCoefficient must be greater than 0.",
      "applicationCoefficient",
    );
  }
  if (workQuantity.lessThan(0)) {
    throw new ResourceCalculationError(
      "work_quantity_negative",
      "workQuantity must not be negative.",
      "workQuantity",
    );
  }
  if (normativeConsumption.lessThan(0)) {
    throw new ResourceCalculationError(
      "normative_consumption_negative",
      "normativeConsumption must not be negative.",
      "normativeConsumption",
    );
  }
  if (resourcePrice.lessThan(0)) {
    throw new ResourceCalculationError(
      "resource_price_negative",
      "resourcePrice must not be negative.",
      "resourcePrice",
    );
  }

  const resourceQuantity = workQuantity
    .dividedBy(normBasisQuantity)
    .times(normativeConsumption)
    .times(applicationCoefficient);
  const effectiveUnitPrice = resourcePrice.dividedBy(priceBasisQuantity);
  const resourceCost = resourceQuantity.times(effectiveUnitPrice);

  return {
    estimateNormVersionId: input.estimateNormVersionId,
    resourceConsumptionId: input.resourceConsumptionId,
    resourceId: input.resourceId,
    resourcePriceId: input.resourcePriceId,
    normApplicationId: input.normApplicationId,
    resourceType: input.resourceType,
    currency: input.currency,
    workQuantity: toDecimalString(workQuantity),
    normBasisQuantity: toDecimalString(normBasisQuantity),
    normativeConsumption: toDecimalString(normativeConsumption),
    applicationCoefficient: toDecimalString(applicationCoefficient),
    resourcePrice: toDecimalString(resourcePrice),
    priceBasisQuantity: toDecimalString(priceBasisQuantity),
    resourceQuantity: toDecimalString(resourceQuantity),
    effectiveUnitPrice: toDecimalString(effectiveUnitPrice),
    resourceCost: toDecimalString(resourceCost),
  };
}

function emptyTotals(): Record<ProfessionalResourceType, DecimalValue> {
  return {
    labor: new Decimal(0),
    material: new Decimal(0),
    machinery: new Decimal(0),
    transport: new Decimal(0),
    energy: new Decimal(0),
    other: new Decimal(0),
  };
}

/**
 * Calculates every resource line and aggregates costs by resource type.
 *
 * A non-empty calculation must share a single currency. Mixing currencies is
 * rejected rather than silently summed, because this kernel does not convert
 * between currencies. An empty calculation has no currency and returns null.
 * Aggregation is simple deterministic addition and carries no normative meaning
 * beyond the sum itself.
 */
export function calculateResources(
  inputs: readonly ResourceCalculationInput[],
): ResourceCalculationResult {
  const lines = inputs.map((input) => calculateResourceLine(input));

  const firstLine = lines[0];
  const currency = firstLine ? firstLine.currency : null;
  for (const line of lines) {
    if (line.currency !== currency) {
      throw new ResourceCalculationError(
        "mixed_currency",
        `All resources in one calculation must share a currency; found ${currency} and ${line.currency}.`,
        "currency",
      );
    }
  }

  const totals = emptyTotals();
  let directResourceTotal = new Decimal(0);
  for (const line of lines) {
    const cost = new Decimal(line.resourceCost);
    totals[line.resourceType] = totals[line.resourceType].plus(cost);
    directResourceTotal = directResourceTotal.plus(cost);
  }

  const totalsByResourceType = {} as ResourceTypeTotals;
  for (const type of PROFESSIONAL_RESOURCE_TYPES) {
    totalsByResourceType[type] = toDecimalString(totals[type]);
  }

  return {
    currency,
    lines,
    totalsByResourceType,
    directResourceTotal: toDecimalString(directResourceTotal),
  };
}
