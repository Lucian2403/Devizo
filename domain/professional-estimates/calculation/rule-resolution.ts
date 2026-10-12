import type { ProfessionalCostStackComponent } from "./cost-stack";
import { Decimal, DecimalParseError, parseDecimal } from "./decimal";

/**
 * Pure professional rule-resolution foundation (M8.3C).
 *
 * Responsibility: given an explicit resolution context and a set of already
 * curated candidate rules, decide which single candidate is eligible for one
 * cost component, or report that resolution is missing or ambiguous.
 *
 * This module intentionally does NOT:
 * - perform the monetary arithmetic of M8.3B (it never applies a rate);
 * - calculate resource quantities/costs (that is M8.3A);
 * - decide the legally correct Moldovan rate automatically;
 * - rank candidates by origin, recency, source or rate value;
 * - classify a resource into a procurement/storage category;
 * - read the database, fetch official sources, or seed any real rates.
 *
 * Date alone never resolves a rule. Investor/contractor perspective and work
 * kind are confirmed context dimensions (CP L.01.01-2012, CP L.01.03-2012,
 * CP L.01.05-2012, CP L.01.07-2012). The caller supplies them explicitly.
 */

/** A calendar date in strict `YYYY-MM-DD` form, consistent with M8.3A. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const ESTIMATE_PERSPECTIVES = ["investor", "contractor"] as const;
export type EstimatePerspective = (typeof ESTIMATE_PERSPECTIVES)[number];

/**
 * A deliberately small, explicit work-kind dimension. This is not a complete
 * Moldovan taxonomy; it is the minimum needed to match candidate rules and can
 * be extended later. The caller classifies the work; this module never does.
 */
export const PROFESSIONAL_WORK_KINDS = [
  "construction",
  "installation",
  "commissioning",
] as const;
export type ProfessionalWorkKind = (typeof PROFESSIONAL_WORK_KINDS)[number];

export const RULE_VALUE_TYPES = [
  "percent",
  "coefficient",
  "fixed_amount",
] as const;
export type RuleValueType = (typeof RULE_VALUE_TYPES)[number];

export const RULE_CALCULATION_BASES = [
  "labor_cost",
  "material_cost",
  "machinery_cost",
  "direct_cost",
  "estimate_cost_before_profit",
  "fixed_amount",
] as const;
export type RuleCalculationBasis = (typeof RULE_CALCULATION_BASES)[number];

/**
 * Where a candidate rule comes from. These values are provenance/context, not
 * an automatic ranking. A contractor rule never beats a sector-average rule
 * merely because of its origin; see `restrictToOrigins` for the only explicit,
 * caller-driven way to narrow by origin.
 */
export const PROFESSIONAL_RULE_ORIGINS = [
  "normative_sector_average",
  "company_individual",
  "contract_agreed",
  "statutory",
] as const;
export type ProfessionalRuleOrigin =
  (typeof PROFESSIONAL_RULE_ORIGINS)[number];

const RESOLVABLE_COMPONENTS: readonly ProfessionalCostStackComponent[] = [
  "labor_contributions",
  "material_transport",
  "procurement_storage",
  "overhead",
  "estimated_profit",
];

/** The literal used to mark a candidate dimension as explicitly context-neutral. */
export const CONTEXT_NEUTRAL = "any";

export interface ProfessionalRuleResolutionContext {
  valuationDate: string;
  estimatePerspective: EstimatePerspective;
  workKind: ProfessionalWorkKind;
  currency: string;
  /**
   * Explicit procurement/storage scope/category supplied by the caller. Required
   * to match a category-specific procurement/storage candidate. The resolver
   * never infers a category from a resource name.
   */
  procurementStorageCategory?: string | null;
  /**
   * Optional explicit origin restriction. When present and non-empty, only
   * candidates whose origin is in the set are eligible. This is the only
   * caller-driven way to distinguish, for example, `contract_agreed` from
   * `company_individual`; it is an explicit choice, not automatic ranking.
   */
  restrictToOrigins?: readonly ProfessionalRuleOrigin[];
}

export interface ProfessionalRuleCandidate {
  candidateId: string;
  component: ProfessionalCostStackComponent;

  valueType: RuleValueType;
  value: string;
  currency: string | null;

  calculationBasis: RuleCalculationBasis;

  validFrom: string;
  validTo: string | null;

  estimatePerspective: EstimatePerspective | typeof CONTEXT_NEUTRAL;
  workKind: ProfessionalWorkKind | typeof CONTEXT_NEUTRAL;
  /**
   * Procurement/storage scope. Required for `procurement_storage` candidates
   * (use `"any"` to mark a candidate as explicitly category-neutral). Ignored
   * for other components.
   */
  procurementCategory?: string | null;

  ruleOrigin: ProfessionalRuleOrigin;

  calculationRuleId?: string | null;
  sourceId?: string | null;
  sourceReference?: string | null;
  applicabilityDecisionId?: string | null;
}

export type RuleResolutionStatus = "selected" | "missing" | "ambiguous";

export interface ProfessionalRuleResolutionResult {
  status: RuleResolutionStatus;
  component: ProfessionalCostStackComponent;
  valuationDate: string;
  /** The single eligible candidate, only when exactly one is eligible. */
  candidate: ProfessionalRuleCandidate | null;
  /** Every candidate eligible for the context (0, 1 or many). */
  eligibleCandidates: ProfessionalRuleCandidate[];
}

export type RuleResolutionValidationErrorCode =
  | "invalid_context"
  | "invalid_date"
  | "invalid_validity_range"
  | "invalid_decimal"
  | "negative_value"
  | "missing_candidate_id"
  | "missing_component"
  | "invalid_component"
  | "missing_origin"
  | "invalid_origin"
  | "missing_perspective"
  | "invalid_perspective"
  | "invalid_work_kind"
  | "invalid_value_type"
  | "invalid_basis"
  | "incompatible_rule_semantics"
  | "fixed_amount_missing_currency"
  | "missing_procurement_category"
  | "empty_provenance_reference";

export class RuleResolutionValidationError extends Error {
  constructor(
    readonly code: RuleResolutionValidationErrorCode,
    message: string,
    readonly candidateId?: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "RuleResolutionValidationError";
  }
}

function assertIsoDate(
  value: unknown,
  field: string,
  candidateId?: string,
): string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    throw new RuleResolutionValidationError(
      "invalid_date",
      `${field} must be a calendar date in YYYY-MM-DD form.`,
      candidateId,
      field,
    );
  }
  const parts = value.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new RuleResolutionValidationError(
      "invalid_date",
      `${field} is not a valid calendar date.`,
      candidateId,
      field,
    );
  }
  return value;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function assertProvenance(
  value: unknown,
  field: string,
  candidateId: string,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw new RuleResolutionValidationError(
      "empty_provenance_reference",
      `${field} must be a non-empty string when supplied.`,
      candidateId,
      field,
    );
  }
  return value;
}

function validateContext(
  context: ProfessionalRuleResolutionContext,
): void {
  if (context == null || typeof context !== "object") {
    throw new RuleResolutionValidationError(
      "invalid_context",
      "A resolution context object is required.",
    );
  }
  assertIsoDate(context.valuationDate, "valuationDate");
  if (!ESTIMATE_PERSPECTIVES.includes(context.estimatePerspective)) {
    throw new RuleResolutionValidationError(
      "invalid_perspective",
      `Context estimatePerspective must be one of: ${ESTIMATE_PERSPECTIVES.join(", ")}.`,
      undefined,
      "estimatePerspective",
    );
  }
  if (!PROFESSIONAL_WORK_KINDS.includes(context.workKind)) {
    throw new RuleResolutionValidationError(
      "invalid_work_kind",
      `Context workKind must be one of: ${PROFESSIONAL_WORK_KINDS.join(", ")}.`,
      undefined,
      "workKind",
    );
  }
  if (!nonEmptyString(context.currency)) {
    throw new RuleResolutionValidationError(
      "invalid_context",
      "Context currency must be a non-empty string.",
      undefined,
      "currency",
    );
  }
  if (
    context.procurementStorageCategory != null &&
    !nonEmptyString(context.procurementStorageCategory)
  ) {
    throw new RuleResolutionValidationError(
      "invalid_context",
      "Context procurementStorageCategory must be a non-empty string when supplied.",
      undefined,
      "procurementStorageCategory",
    );
  }
  if (context.restrictToOrigins != null) {
    if (!Array.isArray(context.restrictToOrigins)) {
      throw new RuleResolutionValidationError(
        "invalid_context",
        "Context restrictToOrigins must be an array when supplied.",
        undefined,
        "restrictToOrigins",
      );
    }
    for (const origin of context.restrictToOrigins) {
      if (!PROFESSIONAL_RULE_ORIGINS.includes(origin)) {
        throw new RuleResolutionValidationError(
          "invalid_origin",
          `Context restrictToOrigins contains an unknown origin: ${String(origin)}.`,
          undefined,
          "restrictToOrigins",
        );
      }
    }
  }
}

function validateCandidate(candidate: ProfessionalRuleCandidate): void {
  if (candidate == null || typeof candidate !== "object") {
    throw new RuleResolutionValidationError(
      "missing_candidate_id",
      "A candidate object is required.",
    );
  }
  if (!nonEmptyString(candidate.candidateId)) {
    throw new RuleResolutionValidationError(
      "missing_candidate_id",
      "candidateId is required.",
      undefined,
      "candidateId",
    );
  }
  const id = candidate.candidateId;

  if (candidate.component == null) {
    throw new RuleResolutionValidationError(
      "missing_component",
      "candidate component is required.",
      id,
      "component",
    );
  }
  if (!RESOLVABLE_COMPONENTS.includes(candidate.component)) {
    throw new RuleResolutionValidationError(
      "invalid_component",
      `candidate component must be one of: ${RESOLVABLE_COMPONENTS.join(", ")}.`,
      id,
      "component",
    );
  }
  if (!RULE_VALUE_TYPES.includes(candidate.valueType)) {
    throw new RuleResolutionValidationError(
      "invalid_value_type",
      `candidate valueType must be one of: ${RULE_VALUE_TYPES.join(", ")}.`,
      id,
      "valueType",
    );
  }
  if (!RULE_CALCULATION_BASES.includes(candidate.calculationBasis)) {
    throw new RuleResolutionValidationError(
      "invalid_basis",
      `candidate calculationBasis must be one of: ${RULE_CALCULATION_BASES.join(", ")}.`,
      id,
      "calculationBasis",
    );
  }

  let parsedValue: InstanceType<typeof Decimal>;
  try {
    parsedValue = parseDecimal(candidate.value, "value");
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new RuleResolutionValidationError(
        "invalid_decimal",
        error.message,
        id,
        "value",
      );
    }
    throw error;
  }
  if (parsedValue.lessThan(0)) {
    throw new RuleResolutionValidationError(
      "negative_value",
      "candidate value must not be negative.",
      id,
      "value",
    );
  }

  if (candidate.valueType === "fixed_amount" && !nonEmptyString(candidate.currency)) {
    throw new RuleResolutionValidationError(
      "fixed_amount_missing_currency",
      "A fixed_amount candidate requires a non-empty currency.",
      id,
      "currency",
    );
  }

  assertComponentSemantics(candidate, id);

  assertIsoDate(candidate.validFrom, "validFrom", id);
  if (candidate.validTo !== null) {
    assertIsoDate(candidate.validTo, "validTo", id);
    if (candidate.validTo < candidate.validFrom) {
      throw new RuleResolutionValidationError(
        "invalid_validity_range",
        "candidate validTo must not be before validFrom.",
        id,
        "validTo",
      );
    }
  }

  if (
    candidate.estimatePerspective !== CONTEXT_NEUTRAL &&
    !ESTIMATE_PERSPECTIVES.includes(candidate.estimatePerspective)
  ) {
    throw new RuleResolutionValidationError(
      "missing_perspective",
      `candidate estimatePerspective must be "${CONTEXT_NEUTRAL}" or one of: ${ESTIMATE_PERSPECTIVES.join(", ")}.`,
      id,
      "estimatePerspective",
    );
  }
  if (
    candidate.workKind !== CONTEXT_NEUTRAL &&
    !PROFESSIONAL_WORK_KINDS.includes(candidate.workKind)
  ) {
    throw new RuleResolutionValidationError(
      "invalid_work_kind",
      `candidate workKind must be "${CONTEXT_NEUTRAL}" or one of: ${PROFESSIONAL_WORK_KINDS.join(", ")}.`,
      id,
      "workKind",
    );
  }

  if (!PROFESSIONAL_RULE_ORIGINS.includes(candidate.ruleOrigin)) {
    throw new RuleResolutionValidationError(
      candidate.ruleOrigin == null ? "missing_origin" : "invalid_origin",
      `candidate ruleOrigin must be one of: ${PROFESSIONAL_RULE_ORIGINS.join(", ")}.`,
      id,
      "ruleOrigin",
    );
  }

  // Procurement/storage must declare an explicit category (which may be the
  // literal "any"); an absent category is never inferred as neutral.
  if (candidate.component === "procurement_storage") {
    if (!nonEmptyString(candidate.procurementCategory)) {
      throw new RuleResolutionValidationError(
        "missing_procurement_category",
        'A procurement_storage candidate requires an explicit procurementCategory (use "any" for a category-neutral candidate).',
        id,
        "procurementCategory",
      );
    }
  }

  assertProvenance(candidate.calculationRuleId, "calculationRuleId", id);
  assertProvenance(candidate.sourceId, "sourceId", id);
  assertProvenance(candidate.sourceReference, "sourceReference", id);
  assertProvenance(
    candidate.applicabilityDecisionId,
    "applicabilityDecisionId",
    id,
  );
}

function assertComponentSemantics(
  candidate: ProfessionalRuleCandidate,
  id: string,
): void {
  // M8.3C only resolves rules the current M8.3B cost stack can apply safely.
  // `coefficient` is not accepted for any of these components yet, even though
  // the persisted CalculationRule model may support it generically.
  const reject = (): never => {
    throw new RuleResolutionValidationError(
      "incompatible_rule_semantics",
      `candidate combination is not valid for ${candidate.component}: valueType ${candidate.valueType} with basis ${candidate.calculationBasis}.`,
      id,
      "calculationBasis",
    );
  };

  switch (candidate.component) {
    case "labor_contributions":
      if (
        candidate.valueType !== "percent" ||
        candidate.calculationBasis !== "labor_cost"
      ) {
        reject();
      }
      break;
    case "material_transport":
      if (
        !(
          (candidate.valueType === "percent" &&
            candidate.calculationBasis === "material_cost") ||
          (candidate.valueType === "fixed_amount" &&
            candidate.calculationBasis === "fixed_amount")
        )
      ) {
        reject();
      }
      break;
    case "procurement_storage":
      if (
        candidate.valueType !== "percent" ||
        candidate.calculationBasis !== "material_cost"
      ) {
        reject();
      }
      break;
    case "overhead":
      if (
        candidate.valueType !== "percent" ||
        (candidate.calculationBasis !== "direct_cost" &&
          candidate.calculationBasis !== "labor_cost")
      ) {
        reject();
      }
      break;
    case "estimated_profit":
      if (
        candidate.valueType !== "percent" ||
        candidate.calculationBasis !== "estimate_cost_before_profit"
      ) {
        reject();
      }
      break;
  }
}

function isDateEligible(
  candidate: ProfessionalRuleCandidate,
  valuationDate: string,
): boolean {
  if (candidate.validFrom > valuationDate) return false;
  if (candidate.validTo !== null && valuationDate > candidate.validTo) {
    return false;
  }
  return true;
}

function matchesContext(
  candidate: ProfessionalRuleCandidate,
  context: ProfessionalRuleResolutionContext,
): boolean {
  if (!isDateEligible(candidate, context.valuationDate)) return false;

  if (
    candidate.estimatePerspective !== CONTEXT_NEUTRAL &&
    candidate.estimatePerspective !== context.estimatePerspective
  ) {
    return false;
  }
  if (
    candidate.workKind !== CONTEXT_NEUTRAL &&
    candidate.workKind !== context.workKind
  ) {
    return false;
  }

  // A fixed monetary value only matches when its currency matches the context.
  if (
    candidate.valueType === "fixed_amount" &&
    candidate.currency !== context.currency
  ) {
    return false;
  }

  // A category-specific procurement/storage candidate needs an explicit,
  // matching context category. A `"any"` candidate is category-neutral.
  if (
    candidate.component === "procurement_storage" &&
    candidate.procurementCategory !== CONTEXT_NEUTRAL
  ) {
    if (
      context.procurementStorageCategory == null ||
      context.procurementStorageCategory !== candidate.procurementCategory
    ) {
      return false;
    }
  }

  // A contractual agreement is never inferred: a `contract_agreed` candidate is
  // eligible only when the caller explicitly opts into that origin.
  if (
    candidate.ruleOrigin === "contract_agreed" &&
    !(
      context.restrictToOrigins != null &&
      context.restrictToOrigins.includes("contract_agreed")
    )
  ) {
    return false;
  }

  // Origin is provenance, not a ranking. It only filters when the caller
  // explicitly restricts origins.
  if (
    context.restrictToOrigins != null &&
    context.restrictToOrigins.length > 0 &&
    !context.restrictToOrigins.includes(candidate.ruleOrigin)
  ) {
    return false;
  }

  return true;
}

/**
 * Resolves a single cost component against the supplied curated candidates.
 *
 * All supplied candidates are validated first; malformed candidates are
 * rejected rather than skipped. Candidates for other components are ignored.
 *
 * - exactly one eligible candidate  -> `selected`
 * - zero eligible candidates        -> `missing`
 * - more than one eligible candidate -> `ambiguous`
 *
 * `missing` is not the same as `not_applicable`; the caller decides that
 * separately. The resolver never invents a default, never picks "latest wins"
 * and never ranks by origin, source or rate.
 */
export function resolveProfessionalRule(
  component: ProfessionalCostStackComponent,
  candidates: readonly ProfessionalRuleCandidate[],
  context: ProfessionalRuleResolutionContext,
): ProfessionalRuleResolutionResult {
  if (!RESOLVABLE_COMPONENTS.includes(component)) {
    throw new RuleResolutionValidationError(
      "invalid_component",
      `Resolution component must be one of: ${RESOLVABLE_COMPONENTS.join(", ")}.`,
      undefined,
      "component",
    );
  }
  validateContext(context);
  for (const candidate of candidates) {
    validateCandidate(candidate);
  }

  const eligibleCandidates = candidates.filter(
    (candidate) =>
      candidate.component === component && matchesContext(candidate, context),
  );

  let status: RuleResolutionStatus;
  if (eligibleCandidates.length === 1) {
    status = "selected";
  } else if (eligibleCandidates.length === 0) {
    status = "missing";
  } else {
    status = "ambiguous";
  }

  return {
    status,
    component,
    valuationDate: context.valuationDate,
    candidate: status === "selected" ? (eligibleCandidates[0] ?? null) : null,
    eligibleCandidates,
  };
}
