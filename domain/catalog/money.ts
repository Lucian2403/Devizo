import Decimal from "decimal.js";

// How the source spreadsheet writes decimal numbers. The user must choose this
// explicitly during import; we never guess an ambiguous separator.
//   "dot"   -> 1,234.56  (comma = thousands, dot = decimal)
//   "comma" -> 1.234,56  (dot = thousands, comma = decimal)
export type DecimalFormat = "dot" | "comma";

export const DECIMAL_FORMAT_EXAMPLES: Record<DecimalFormat, string> = {
  dot: "1,234.56",
  comma: "1.234,56",
};

// Turns a raw price cell into a canonical decimal string (e.g. "1234.56").
// Currency symbols and whitespace are stripped; the separator meaning is taken
// strictly from the chosen format, so nothing is guessed.
// Returns null when the value is empty or not a valid number.
export function normalizePrice(
  raw: string,
  format: DecimalFormat,
): string | null {
  if (raw == null) return null;

  // Strip everything except digits, separators and a leading minus sign.
  let cleaned = raw.replace(/[^0-9.,-]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;

  if (format === "dot") {
    // Commas are thousands separators; remove them. Dot stays as decimal.
    cleaned = cleaned.replace(/,/g, "");
  } else {
    // Dots are thousands separators; remove them. Comma becomes the decimal.
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
  }

  try {
    const value = new Decimal(cleaned);
    if (!value.isFinite()) return null;
    // Store with two decimal places to match the NUMERIC(12,2) column.
    return value.toFixed(2);
  } catch {
    return null;
  }
}

// Selling price must be present and non-negative. Cost price is optional.
export function isNonNegative(value: string): boolean {
  try {
    return new Decimal(value).greaterThanOrEqualTo(0);
  } catch {
    return false;
  }
}
