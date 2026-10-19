import type { ResourceTypeTotals } from "./resource-calculation";
import { Decimal, DecimalParseError, parseDecimal, toDecimalString } from "./decimal";

/**
 * Pure cost-stack calculator (M8.3B).
 *
 * The input contains raw resource totals from M8.3A and explicit, already
 * resolved decisions for each additional component. This module does not decide
 * legal applicability, select rules, access persistence or apply commercial
 * quote pricing.
 */

export type ProfessionalCostStackComponent =
  | "labor_contributions"
  | "material_transport"
  | "procurement_storage"
  | "overhead"
  | "estimated_profit";

export type CostStackValidationErrorCode =
  | "missing_decision"
  | "invalid_decision"
  | "missing_reason"
  | "invalid_rule"
  | "invalid_decimal"
  | "negative_rate"
  | "negative_amount"
  | "invalid_overhead_basis"
  | "nonzero_basis"
  | "unsupported_transport_method"
  | "currency_mismatch"
  | "missing_resource_calculation"
  | "missing_resource_currency"
  | "resource_total_mismatch";

export class CostStackValidationError extends Error {
  constructor(
    readonly code: CostStackValidationErrorCode,
    message: string,
    readonly component?: ProfessionalCostStackComponent | "resource_totals",
    readonly field?: string,
  ) {
    super(message);
    this.name = "CostStackValidationError";
  }
}

export interface ResolvedCostRuleReference {
  /** The supplied resolved rule type; no type or rule is inferred here. */
  ruleType: string;
  calculationRuleId?: string | null;
  sourceId?: string | null;
  sourceReference?: string | null;
  professionalRuleDefinitionId?: string | null;
  ruleOrigin?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  estimatePerspective?: string | null;
  workKind?: string | null;
}

export interface NotApplicableDecision {
  status: "not_applicable";
  reason: string;
}

export interface ZeroBasisDecision {
  status: "zero_basis";
  basis:
    | "labor_cost"
    | "material_cost"
    | "direct_cost"
    | "estimate_cost_before_profit";
}

export interface AppliedPercentageDecision {
  status: "applied";
  ratePercent: string;
  rule: ResolvedCostRuleReference;
}

export type LaborContributionsDecision =
  | NotApplicableDecision
  | ZeroBasisDecision
  | AppliedPercentageDecision;

export type MaterialTransportDecision =
  | NotApplicableDecision
  | ZeroBasisDecision
  | {
      status: "applied";
      method: "percentage_of_material";
      ratePercent: string;
      rule: ResolvedCostRuleReference;
    }
  | {
      status: "applied";
      method: "fixed_amount";
      amount: string;
      currency: string;
      rule: ResolvedCostRuleReference;
    }
  | {
      /**
       * Unsupported methods are representable so an attempted request can
       * fail explicitly rather than being approximated or silently ignored.
       */
      status: "applied";
      method: "unsupported";
      requestedMethod: string;
      rule: ResolvedCostRuleReference;
    };

export type ProcurementStorageDecision =
  | NotApplicableDecision
  | ZeroBasisDecision
  | AppliedPercentageDecision
  | {
      status: "applied";
      method: "resolved_total";
      amount: string;
      currency: string;
      applications: {
        materialBase: string;
        ratePercent: string;
        amount: string;
        rule: ResolvedCostRuleReference;
      }[];
    };

type ResolvedProcurementStorageDecision = Extract<
    ProcurementStorageDecision,
    { method: "resolved_total" }
>;

function isResolvedProcurementStorageDecision(
    value: unknown,
): value is ResolvedProcurementStorageDecision {
    return (
      isRecord(value) &&
      value.status === "applied" &&
      value.method === "resolved_total" &&
      Array.isArray(value.applications)
    );
}

function isAppliedPercentageDecision(
    value: unknown,
): value is AppliedPercentageDecision {
    return (
      isRecord(value) &&
      value.status === "applied" &&
      typeof value.ratePercent === "string"
    );
}

export type OverheadDecision =
  | NotApplicableDecision
  | ZeroBasisDecision
  | (AppliedPercentageDecision & {
      basis: "direct_cost" | "labor_cost";
    });

export type EstimatedProfitDecision =
  | NotApplicableDecision
  | ZeroBasisDecision
  | AppliedPercentageDecision;

export interface ProfessionalCostStackInput {
  /**
   * The M8.3A resource calculation result (or an equivalent structure). The raw
   * resource totals carry their own currency so a caller cannot relabel EUR
   * totals as MDL. `ResourceCalculationResult` is assignable here directly.
   */
  resourceCalculation: CostStackResourceCalculation;
  laborContributions: LaborContributionsDecision;
  materialTransport: MaterialTransportDecision;
  procurementStorage: ProcurementStorageDecision;
  overhead: OverheadDecision;
  estimatedProfit: EstimatedProfitDecision;
}

/**
 * The subset of the M8.3A `ResourceCalculationResult` the cost stack consumes.
 * `currency` is nullable because an empty M8.3A calculation has no currency;
 * the cost stack rejects that case rather than inventing one.
 */
export interface CostStackResourceCalculation {
  currency: string | null;
  totalsByResourceType: ResourceTypeTotals;
  directResourceTotal: string;
}

export interface CostStackRuleApplication {
  component: ProfessionalCostStackComponent;
  ruleType: string;
  basis:
    | "labor_cost"
    | "material_cost"
    | "fixed_amount"
    | "direct_cost"
    | "estimate_cost_before_profit";
  ratePercent: string | null;
  value: string | null;
  amount: string;
  calculationRuleId: string | null;
  sourceId: string | null;
  sourceReference: string | null;
  professionalRuleDefinitionId: string | null;
  ruleOrigin: string | null;
  validFrom: string | null;
  validTo: string | null;
  estimatePerspective: string | null;
  workKind: string | null;
}

export type CostStackDecisionResult =
  | { status: "applied" }
  | { status: "not_applicable"; reason: string }
  | { status: "zero_basis"; basis: ZeroBasisDecision["basis"] };

export type CostStackDecisionResults = Record<
  ProfessionalCostStackComponent,
  CostStackDecisionResult
>;

export interface ProfessionalCostStackResult {
  currency: string;

  laborCost: string;
  materialCost: string;
  machineryCost: string;
  transportResourceCost: string;
  energyCost: string;
  otherCost: string;
  rawResourceTotal: string;

  laborContributions: string;
  materialTransport: string;
  procurementStorage: string;
  directCost: string;

  overhead: string;
  estimateCostBeforeProfit: string;
  estimatedProfit: string;
  estimateSubtotalBeforeLimitedCostsAndVat: string;

  decisions: CostStackDecisionResults;
  /** Applied rules in the actual calculation order. */
  appliedRules: CostStackRuleApplication[];
}

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decimal(
  value: unknown,
  field: string,
  component: ProfessionalCostStackComponent | "resource_totals",
): InstanceType<typeof Decimal> {
  if (typeof value !== "string") {
    throw new CostStackValidationError(
      "invalid_decimal",
      `${field} must be supplied as a decimal string.`,
      component,
      field,
    );
  }
  try {
    return parseDecimal(value, field);
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new CostStackValidationError(
        "invalid_decimal",
        error.message,
        component,
        field,
      );
    }
    throw error;
  }
}

function requiredText(
  value: unknown,
  field: string,
  component: ProfessionalCostStackComponent,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CostStackValidationError(
      "invalid_rule",
      `${field} is required for an applied rule.`,
      component,
      field,
    );
  }
  return value.trim();
}

function optionalReference(
  value: unknown,
  field: string,
  component: ProfessionalCostStackComponent,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw new CostStackValidationError(
      "invalid_rule",
      `${field} must be a non-empty string when supplied.`,
      component,
      field,
    );
  }
  return value.trim();
}

function assertDecision(
  value: unknown,
  component: ProfessionalCostStackComponent,
): asserts value is Record<string, unknown> {
  if (value == null) {
    throw new CostStackValidationError(
      "missing_decision",
      `An explicit applied/not-applicable decision is required for ${component}.`,
      component,
    );
  }
  if (!isRecord(value)) {
    throw new CostStackValidationError(
      "invalid_decision",
      `The decision for ${component} must be an object.`,
      component,
    );
  }
  if (
    value.status !== "applied" &&
    value.status !== "not_applicable" &&
    value.status !== "zero_basis"
  ) {
    throw new CostStackValidationError(
      "invalid_decision",
      `The decision for ${component} must explicitly be applied or not_applicable.`,
      component,
      "status",
    );
  }
  if (value.status === "not_applicable") {
    if (typeof value.reason !== "string" || value.reason.trim() === "") {
      throw new CostStackValidationError(
        "missing_reason",
        `A reason is required when ${component} is not applicable.`,
        component,
        "reason",
      );
    }
  }
  if (
    value.status === "zero_basis" &&
    ![
      "labor_cost",
      "material_cost",
      "direct_cost",
      "estimate_cost_before_profit",
    ].includes(String(value.basis))
  ) {
    throw new CostStackValidationError(
      "invalid_decision",
      `A valid zero basis is required for ${component}.`,
      component,
      "basis",
    );
  }
}

function ruleReference(
  value: unknown,
  component: ProfessionalCostStackComponent,
): Omit<
  CostStackRuleApplication,
  "component" | "basis" | "ratePercent" | "value" | "amount"
> {
  if (!isRecord(value)) {
    throw new CostStackValidationError(
      "invalid_rule",
      `A resolved rule reference is required for ${component}.`,
      component,
      "rule",
    );
  }
  return {
    ruleType: requiredText(value.ruleType, "ruleType", component),
    calculationRuleId: optionalReference(
      value.calculationRuleId,
      "calculationRuleId",
      component,
    ),
    sourceId: optionalReference(value.sourceId, "sourceId", component),
    sourceReference: optionalReference(
      value.sourceReference,
      "sourceReference",
      component,
    ),
    professionalRuleDefinitionId: optionalReference(
      value.professionalRuleDefinitionId,
      "professionalRuleDefinitionId",
      component,
    ),
    ruleOrigin: optionalReference(value.ruleOrigin, "ruleOrigin", component),
    validFrom: optionalReference(value.validFrom, "validFrom", component),
    validTo: optionalReference(value.validTo, "validTo", component),
    estimatePerspective: optionalReference(
      value.estimatePerspective,
      "estimatePerspective",
      component,
    ),
    workKind: optionalReference(value.workKind, "workKind", component),
  };
}

function rate(
  value: unknown,
  component: ProfessionalCostStackComponent,
): InstanceType<typeof Decimal> {
  const parsed = decimal(value, "ratePercent", component);
  if (parsed.lessThan(0)) {
    throw new CostStackValidationError(
      "negative_rate",
      `ratePercent for ${component} must not be negative.`,
      component,
      "ratePercent",
    );
  }
  return parsed;
}

function notApplicableReason(
  decision: Record<string, unknown>,
): string {
  return (decision.reason as string).trim();
}

function componentResult(
  decision: Record<string, unknown>,
): CostStackDecisionResult {
  if (decision.status === "not_applicable") {
    return { status: "not_applicable", reason: notApplicableReason(decision) };
  }
  if (decision.status === "zero_basis") {
    return {
      status: "zero_basis",
      basis: decision.basis as ZeroBasisDecision["basis"],
    };
  }
  return { status: "applied" };
}

function assertZeroBasis(
  decision: unknown,
  component: ProfessionalCostStackComponent,
  expectedBasis: ZeroBasisDecision["basis"],
  amount: InstanceType<typeof Decimal>,
): void {
  if (!isRecord(decision) || decision.status !== "zero_basis") return;
  if (decision.basis !== expectedBasis || !amount.isZero()) {
    throw new CostStackValidationError(
      "nonzero_basis",
      `The ${component} zero_basis decision does not match an exactly zero ${expectedBasis} basis.`,
      component,
      "basis",
    );
  }
}

function ruleApplication(
  component: ProfessionalCostStackComponent,
  basis: CostStackRuleApplication["basis"],
  reference: ReturnType<typeof ruleReference>,
  amount: InstanceType<typeof Decimal>,
  ratePercent: InstanceType<typeof Decimal> | null,
  value: InstanceType<typeof Decimal> | null,
): CostStackRuleApplication {
  return {
    component,
    ...reference,
    basis,
    ratePercent: ratePercent ? toDecimalString(ratePercent) : null,
    value: value ? toDecimalString(value) : null,
    amount: toDecimalString(amount),
  };
}

function percentAmount(
  basis: InstanceType<typeof Decimal>,
  ratePercent: InstanceType<typeof Decimal>,
): InstanceType<typeof Decimal> {
  return basis.times(ratePercent).dividedBy(HUNDRED);
}

/**
 * Calculates the resolved professional cost stack.
 *
 * Order:
 * raw resource totals
 * -> labor contributions
 * -> material transport
 * -> procurement/storage (material base only)
 * -> direct cost
 * -> overhead (explicit direct-cost or labor-cost basis)
 * -> estimate cost before profit
 * -> estimated profit (always estimate cost before profit basis)
 * -> subtotal before limited costs and VAT.
 *
 * No default percentages or applicability decisions exist in this function.
 */
export function calculateProfessionalCostStack(
  input: ProfessionalCostStackInput,
): ProfessionalCostStackResult {
  const resourceCalculation = input.resourceCalculation;
  if (!isRecord(resourceCalculation)) {
    throw new CostStackValidationError(
      "missing_resource_calculation",
      "A resource calculation result from M8.3A is required.",
      "resource_totals",
    );
  }
  if (
    typeof resourceCalculation.currency !== "string" ||
    resourceCalculation.currency.trim() === ""
  ) {
    // An empty M8.3A calculation has currency null; never invent one here.
    throw new CostStackValidationError(
      "missing_resource_currency",
      "The resource calculation currency must be a non-null, non-empty string. An empty resource calculation cannot be costed.",
      "resource_totals",
      "currency",
    );
  }
  const currency = resourceCalculation.currency.trim();
  if (!isRecord(resourceCalculation.totalsByResourceType)) {
    throw new CostStackValidationError(
      "invalid_decision",
      "Raw resource totals from M8.3A are required.",
      "resource_totals",
    );
  }
  const procurementStorageInput = input.procurementStorage;
  assertDecision(input.laborContributions, "labor_contributions");
  assertDecision(input.materialTransport, "material_transport");
  assertDecision(input.procurementStorage, "procurement_storage");
  assertDecision(input.overhead, "overhead");
  assertDecision(input.estimatedProfit, "estimated_profit");
  const decisions: CostStackDecisionResults = {
    labor_contributions: componentResult(input.laborContributions),
    material_transport: componentResult(input.materialTransport),
    procurement_storage: componentResult(input.procurementStorage),
    overhead: componentResult(input.overhead),
    estimated_profit: componentResult(input.estimatedProfit),
  };

  const resourceTotal = (
    resourceType: keyof ResourceTypeTotals,
  ): InstanceType<typeof Decimal> => {
    const value = decimal(
      resourceCalculation.totalsByResourceType[resourceType],
      `${resourceType}Cost`,
      "resource_totals",
    );
    if (value.lessThan(0)) {
      throw new CostStackValidationError(
        "negative_amount",
        `${resourceType}Cost must not be negative.`,
        "resource_totals",
        resourceType,
      );
    }
    return value;
  };

  const laborCost = resourceTotal("labor");
  const materialCost = resourceTotal("material");
  const machineryCost = resourceTotal("machinery");
  const transportResourceCost = resourceTotal("transport");
  const energyCost = resourceTotal("energy");
  const otherCost = resourceTotal("other");
  const rawResourceTotal = laborCost
    .plus(materialCost)
    .plus(machineryCost)
    .plus(transportResourceCost)
    .plus(energyCost)
    .plus(otherCost);

  // Integrity: the recomputed raw total must match M8.3A's directResourceTotal
  // exactly, so tampered or inconsistent inputs are rejected without rounding.
  const suppliedDirectResourceTotal = decimal(
    resourceCalculation.directResourceTotal,
    "directResourceTotal",
    "resource_totals",
  );
  if (!rawResourceTotal.equals(suppliedDirectResourceTotal)) {
    throw new CostStackValidationError(
      "resource_total_mismatch",
      `Recomputed raw resource total ${toDecimalString(rawResourceTotal)} does not match the supplied M8.3A directResourceTotal ${toDecimalString(suppliedDirectResourceTotal)}.`,
      "resource_totals",
      "directResourceTotal",
    );
  }

  const appliedRules: CostStackRuleApplication[] = [];

  let laborContributions = ZERO;
  assertZeroBasis(
    input.laborContributions,
    "labor_contributions",
    "labor_cost",
    laborCost,
  );
  if (input.laborContributions.status === "applied") {
    const laborRate = rate(
      input.laborContributions.ratePercent,
      "labor_contributions",
    );
    laborContributions = percentAmount(laborCost, laborRate);
    appliedRules.push(
      ruleApplication(
        "labor_contributions",
        "labor_cost",
        ruleReference(input.laborContributions.rule, "labor_contributions"),
        laborContributions,
        laborRate,
        null,
      ),
    );
  }

  let materialTransport = ZERO;
  assertZeroBasis(
    input.materialTransport,
    "material_transport",
    "material_cost",
    materialCost,
  );
  if (input.materialTransport.status === "applied") {
    const method = input.materialTransport.method;
    if (method === "percentage_of_material") {
      const transportRate = rate(
        input.materialTransport.ratePercent,
        "material_transport",
      );
      materialTransport = percentAmount(materialCost, transportRate);
      appliedRules.push(
        ruleApplication(
          "material_transport",
          "material_cost",
          ruleReference(input.materialTransport.rule, "material_transport"),
          materialTransport,
          transportRate,
          null,
        ),
      );
    } else if (method === "fixed_amount") {
      const fixedAmount = decimal(
        input.materialTransport.amount,
        "amount",
        "material_transport",
      );
      if (fixedAmount.lessThan(0)) {
        throw new CostStackValidationError(
          "negative_amount",
          "Fixed material transport amount must not be negative.",
          "material_transport",
          "amount",
        );
      }
      if (
        typeof input.materialTransport.currency !== "string" ||
        input.materialTransport.currency.trim() !== currency
      ) {
        throw new CostStackValidationError(
          "currency_mismatch",
          `Fixed material transport currency must match calculation currency ${currency}.`,
          "material_transport",
          "currency",
        );
      }
      materialTransport = fixedAmount;
      appliedRules.push(
        ruleApplication(
          "material_transport",
          "fixed_amount",
          ruleReference(input.materialTransport.rule, "material_transport"),
          materialTransport,
          null,
          fixedAmount,
        ),
      );
    } else {
      throw new CostStackValidationError(
        "unsupported_transport_method",
        `Unsupported material transport method: ${String(method)}.`,
        "material_transport",
        "method",
      );
    }
  }

  let procurementStorage = ZERO;
  assertZeroBasis(
    procurementStorageInput,
    "procurement_storage",
    "material_cost",
    materialCost,
  );
  if (procurementStorageInput.status === "applied") {
    if (
      isResolvedProcurementStorageDecision(procurementStorageInput)
    ) {
      if (
        typeof procurementStorageInput.currency !== "string" ||
        procurementStorageInput.currency.trim() !== currency
      ) {
        throw new CostStackValidationError(
          "currency_mismatch",
          `Resolved procurement/storage currency must match calculation currency ${currency}.`,
          "procurement_storage",
          "currency",
        );
      }
      const suppliedAmount = decimal(
        procurementStorageInput.amount,
        "amount",
        "procurement_storage",
      );
      if (suppliedAmount.lessThan(0) || procurementStorageInput.applications.length === 0) {
        throw new CostStackValidationError(
          "invalid_rule",
          "A resolved procurement/storage total requires non-negative amount and exact rule applications.",
          "procurement_storage",
          "applications",
        );
      }
      let verifiedAmount = ZERO;
      for (const application of procurementStorageInput.applications) {
        const materialBase = decimal(
          application.materialBase,
          "materialBase",
          "procurement_storage",
        );
        const applicationRate = rate(
          application.ratePercent,
          "procurement_storage",
        );
        const applicationAmount = decimal(
          application.amount,
          "application.amount",
          "procurement_storage",
        );
        if (!percentAmount(materialBase, applicationRate).equals(applicationAmount)) {
          throw new CostStackValidationError(
            "invalid_rule",
            "A procurement/storage application amount does not match its exact material base and rate.",
            "procurement_storage",
            "applications",
          );
        }
        verifiedAmount = verifiedAmount.plus(applicationAmount);
        appliedRules.push(
          ruleApplication(
            "procurement_storage",
            "material_cost",
            ruleReference(application.rule, "procurement_storage"),
            applicationAmount,
            applicationRate,
            null,
          ),
        );
      }
      if (!verifiedAmount.equals(suppliedAmount)) {
        throw new CostStackValidationError(
          "resource_total_mismatch",
          "Resolved procurement/storage total does not match its exact applications.",
          "procurement_storage",
          "amount",
        );
      }
      procurementStorage = suppliedAmount;
    } else if (isAppliedPercentageDecision(procurementStorageInput)) {
      const storageRate = rate(
        procurementStorageInput.ratePercent,
        "procurement_storage",
      );
      procurementStorage = percentAmount(materialCost, storageRate);
      appliedRules.push(
        ruleApplication(
          "procurement_storage",
          "material_cost",
          ruleReference(procurementStorageInput.rule, "procurement_storage"),
          procurementStorage,
          storageRate,
          null,
        ),
      );
    } else {
      throw new CostStackValidationError(
        "invalid_decision",
        "An applied procurement/storage decision must carry an exact resolved total or percentage rule.",
        "procurement_storage",
      );
    }
  }

  const directCost = rawResourceTotal
    .plus(laborContributions)
    .plus(materialTransport)
    .plus(procurementStorage);

  let overhead = ZERO;
  if (input.overhead.status === "zero_basis") {
    if (
      input.overhead.basis !== "direct_cost" &&
      input.overhead.basis !== "labor_cost"
    ) {
      throw new CostStackValidationError(
        "invalid_overhead_basis",
        `Unsupported overhead zero basis: ${String(input.overhead.basis)}.`,
        "overhead",
        "basis",
      );
    }
    const basis =
      input.overhead.basis === "labor_cost" ? laborCost : ZERO;
    const actualBasis =
      input.overhead.basis === "direct_cost" ? directCost : basis;
    assertZeroBasis(input.overhead, "overhead", input.overhead.basis, actualBasis);
  }
  if (input.overhead.status === "applied") {
    const overheadRate = rate(input.overhead.ratePercent, "overhead");
    let overheadBasis: InstanceType<typeof Decimal>;
    if (input.overhead.basis === "direct_cost") {
      overheadBasis = directCost;
    } else if (input.overhead.basis === "labor_cost") {
      overheadBasis = laborCost;
    } else {
      throw new CostStackValidationError(
        "invalid_overhead_basis",
        `Unsupported overhead basis: ${String(input.overhead.basis)}.`,
        "overhead",
        "basis",
      );
    }
    overhead = percentAmount(overheadBasis, overheadRate);
    appliedRules.push(
      ruleApplication(
        "overhead",
        input.overhead.basis,
        ruleReference(input.overhead.rule, "overhead"),
        overhead,
        overheadRate,
        null,
      ),
    );
  }

  const estimateCostBeforeProfit = directCost.plus(overhead);

  let estimatedProfit = ZERO;
  assertZeroBasis(
    input.estimatedProfit,
    "estimated_profit",
    "estimate_cost_before_profit",
    estimateCostBeforeProfit,
  );
  if (input.estimatedProfit.status === "applied") {
    const profitRate = rate(
      input.estimatedProfit.ratePercent,
      "estimated_profit",
    );
    estimatedProfit = percentAmount(estimateCostBeforeProfit, profitRate);
    appliedRules.push(
      ruleApplication(
        "estimated_profit",
        "estimate_cost_before_profit",
        ruleReference(input.estimatedProfit.rule, "estimated_profit"),
        estimatedProfit,
        profitRate,
        null,
      ),
    );
  }

  const estimateSubtotalBeforeLimitedCostsAndVat =
    estimateCostBeforeProfit.plus(estimatedProfit);

  return {
    currency,
    laborCost: toDecimalString(laborCost),
    materialCost: toDecimalString(materialCost),
    machineryCost: toDecimalString(machineryCost),
    transportResourceCost: toDecimalString(transportResourceCost),
    energyCost: toDecimalString(energyCost),
    otherCost: toDecimalString(otherCost),
    rawResourceTotal: toDecimalString(rawResourceTotal),
    laborContributions: toDecimalString(laborContributions),
    materialTransport: toDecimalString(materialTransport),
    procurementStorage: toDecimalString(procurementStorage),
    directCost: toDecimalString(directCost),
    overhead: toDecimalString(overhead),
    estimateCostBeforeProfit: toDecimalString(estimateCostBeforeProfit),
    estimatedProfit: toDecimalString(estimatedProfit),
    estimateSubtotalBeforeLimitedCostsAndVat: toDecimalString(
      estimateSubtotalBeforeLimitedCostsAndVat,
    ),
    decisions,
    appliedRules,
  };
}
