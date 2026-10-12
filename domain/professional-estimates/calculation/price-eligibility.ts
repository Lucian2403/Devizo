/**
 * Pure resource-price eligibility check for the professional resource method.
 *
 * This module only decides which ResourcePrice records are valid for a given
 * valuation date. It never invents a tie-break rule. When more than one price
 * is eligible the result is explicitly `ambiguous`, because no confirmed
 * normative/business rule exists yet for resolving overlapping prices
 * ("latest wins", "highest-priority source wins", etc. are NOT assumed here).
 *
 * The function is pure: it takes explicit candidate objects and a valuation
 * date and returns a deterministic result. It performs no database access.
 */

/** A calendar date in strict `YYYY-MM-DD` form. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type PriceEligibilityStatus = "selected" | "missing" | "ambiguous";

/**
 * A candidate ResourcePrice as it enters the eligibility check. Provenance
 * identifiers are preserved so a later calculation snapshot can reference the
 * exact price that was selected. Monetary and quantity values stay as decimal
 * strings and are not interpreted here.
 */
export interface ResourcePriceCandidate {
  resourcePriceId: string;
  resourceId: string;
  sourceId: string | null;
  price: string;
  priceBasisQuantity: string;
  currency: string;
  validFrom: string;
  validTo: string | null;
}

export interface PriceEligibilityResult {
  status: PriceEligibilityStatus;
  valuationDate: string;
  /** Every candidate whose validity window covers the valuation date. */
  eligible: ResourcePriceCandidate[];
  /** The single eligible candidate, only when exactly one is eligible. */
  selected: ResourcePriceCandidate | null;
}

export class PriceEligibilityError extends Error {
  constructor(
    readonly field: string,
    readonly value: unknown,
  ) {
    super(`${field} must be a calendar date in YYYY-MM-DD form.`);
    this.name = "PriceEligibilityError";
  }
}

export class PriceCandidateConsistencyError extends Error {
  constructor(readonly resourceIds: string[]) {
    super(
      `All price candidates in one selection must share a resourceId; found: ${resourceIds.join(", ")}.`,
    );
    this.name = "PriceCandidateConsistencyError";
  }
}

function assertIsoDate(value: string, field: string): void {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    throw new PriceEligibilityError(field, value);
  }
  // Reject impossible calendar dates (for example 2026-02-30) without routing
  // through locale parsing. Comparisons below are plain lexicographic string
  // comparisons, which are correct for validated ISO dates.
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
    throw new PriceEligibilityError(field, value);
  }
}

/**
 * A price is date-eligible when:
 *   validFrom <= valuationDate
 *   AND (validTo is null OR valuationDate <= validTo)
 *
 * Both boundaries are inclusive.
 */
export function isPriceDateEligible(
  candidate: ResourcePriceCandidate,
  valuationDate: string,
): boolean {
  assertIsoDate(valuationDate, "valuationDate");
  assertIsoDate(candidate.validFrom, "validFrom");
  if (candidate.validTo !== null) {
    assertIsoDate(candidate.validTo, "validTo");
  }
  if (candidate.validFrom > valuationDate) return false;
  if (candidate.validTo !== null && valuationDate > candidate.validTo) {
    return false;
  }
  return true;
}

/**
 * Selects the eligible price for a valuation date.
 *
 * All candidates must belong to the same resource. Mixing resources in one
 * selection is an explicit validation error, not an `ambiguous` result.
 *
 * - exactly one eligible price  -> `selected`
 * - zero eligible prices        -> `missing`
 * - more than one eligible price -> `ambiguous`
 */
export function selectEligibleResourcePrice(
  candidates: readonly ResourcePriceCandidate[],
  valuationDate: string,
): PriceEligibilityResult {
  assertIsoDate(valuationDate, "valuationDate");
  const resourceIds = [
    ...new Set(candidates.map((candidate) => candidate.resourceId)),
  ];
  if (resourceIds.length > 1) {
    throw new PriceCandidateConsistencyError(resourceIds);
  }
  const eligible = candidates.filter((candidate) =>
    isPriceDateEligible(candidate, valuationDate),
  );
  let status: PriceEligibilityStatus;
  if (eligible.length === 1) {
    status = "selected";
  } else if (eligible.length === 0) {
    status = "missing";
  } else {
    status = "ambiguous";
  }
  const selected = status === "selected" ? (eligible[0] ?? null) : null;
  return {
    status,
    valuationDate,
    eligible,
    selected,
  };
}
