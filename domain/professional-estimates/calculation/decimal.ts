import DecimalBase from "decimal.js";

/**
 * Deterministic Decimal constructor for the professional calculation kernel.
 *
 * The kernel must never use native JavaScript floating-point arithmetic for
 * quantities or money. This clone fixes the precision and notation so results
 * are reproducible regardless of any global decimal.js configuration elsewhere
 * in the process.
 *
 * - `precision: 40` keeps enough significant digits that non-terminating
 *   divisions (for example 1/3) stay deterministic without rounding every
 *   intermediate value to a money scale. The kernel deliberately does NOT round
 *   to 2 decimals; official-form rounding is a separate, later concern.
 * - `toExpNeg`/`toExpPos` are pushed far out so `toString()` always produces
 *   plain decimal notation instead of exponential notation.
 */
export const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
  toExpNeg: -9e15,
  toExpPos: 9e15,
});

export type DecimalValue = InstanceType<typeof Decimal>;

export class DecimalParseError extends Error {
  constructor(
    readonly field: string,
    readonly value: unknown,
  ) {
    super(`${field} must be a finite decimal string.`);
    this.name = "DecimalParseError";
  }
}

/**
 * Parses a decimal string into a Decimal, rejecting anything that is not a
 * finite decimal number. Values are never routed through `Number`, so no
 * float precision is lost before decimal.js sees them.
 */
export function parseDecimal(value: string, field: string): DecimalValue {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DecimalParseError(field, value);
  }
  let parsed: DecimalValue;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new DecimalParseError(field, value);
  }
  if (!parsed.isFinite()) {
    throw new DecimalParseError(field, value);
  }
  return parsed;
}

/** Canonical plain-decimal string (no exponential notation, no forced scale). */
export function toDecimalString(value: DecimalValue): string {
  return value.toString();
}
