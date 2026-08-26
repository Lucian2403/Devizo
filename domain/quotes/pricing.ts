import Decimal from "decimal.js";

/**
 * Deterministic pricing for quotes. All money is handled with decimal.js and
 * returned as fixed-2 strings so it maps directly to PostgreSQL NUMERIC(12,2).
 * The LLM never touches these numbers; this is the single source of truth.
 *
 * Calculation order (as specified for Milestone 4):
 *   line_total      = round(unit_price × quantity × (1 − line_discount%/100), 2)
 *   subtotal        = sum(line_totals)
 *   discount_amount = round(subtotal × quote_discount%/100, 2)
 *   taxable_amount  = subtotal − discount_amount
 *   vat_amount      = round(taxable_amount × vat_rate%/100, 2)
 *   total           = taxable_amount + vat_amount
 */

// One line as it enters the engine. Prices/quantities are strings to avoid any
// float parsing before decimal.js sees them.
export interface PricingLineInput {
  unitPrice: string;
  quantity: string;
  discountPct?: string | null;
}

export interface PricingTotalsInput {
  lines: PricingLineInput[];
  quoteDiscountPct?: string | null;
  vatRate?: string | null;
}

export interface PricedTotals {
  lineTotals: string[]; // one fixed-2 total per input line, same order
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  vatAmount: string;
  total: string;
}

function d(value: string | null | undefined): Decimal {
  if (value == null || value === "") return new Decimal(0);
  return new Decimal(value);
}

// Rounds half-up to 2 decimals, matching typical invoice rounding.
function money(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

// Computes a single line total (already rounded to money precision).
export function computeLineTotal(line: PricingLineInput): string {
  const gross = d(line.unitPrice).times(d(line.quantity));
  const factor = new Decimal(1).minus(d(line.discountPct).div(100));
  return money(gross.times(factor));
}

// Computes all totals for a quote version deterministically.
export function computeTotals(input: PricingTotalsInput): PricedTotals {
  const lineTotals = input.lines.map(computeLineTotal);

  const subtotal = lineTotals.reduce(
    (sum, lt) => sum.plus(new Decimal(lt)),
    new Decimal(0),
  );

  const discountAmount = money(subtotal.times(d(input.quoteDiscountPct).div(100)));
  const taxableAmount = subtotal.minus(new Decimal(discountAmount));
  const vatAmount = money(taxableAmount.times(d(input.vatRate).div(100)));
  const total = taxableAmount.plus(new Decimal(vatAmount));

  return {
    lineTotals,
    subtotal: money(subtotal),
    discountAmount,
    taxableAmount: money(taxableAmount),
    vatAmount,
    total: money(total),
  };
}
