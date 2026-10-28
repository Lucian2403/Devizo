import { Decimal, parseDecimal, toDecimalString } from "./decimal";
import type {
  ProfessionalGeneralEstimateChapterTotals,
  ProfessionalGeneralEstimateTotals,
} from "./general-estimate";

/** CP L.01.01-2012, pct. 6.11; a separate row AFTER Chapters 1–12. */
export const GENERAL_RESERVE_RATES = {
  social: { label: "Obiectiv din sfera socială", percent: "2" },
  production: { label: "Obiectiv de producere", percent: "3" },
  feasibility: { label: "Studiu / calcul tehnico-economic (SF/TEO/TER)", percent: "6" },
} as const;

export type GeneralReserveCategory = keyof typeof GENERAL_RESERVE_RATES;
export type GeneralReserveAmount = ProfessionalGeneralEstimateChapterTotals;

export interface GeneralReserveResult {
  category: GeneralReserveCategory;
  ratePercent: string;
  base: GeneralReserveAmount;
  reserve: GeneralReserveAmount;
  withReserve: GeneralReserveAmount;
  sourceReference: "CP L.01.01-2012, pct. 6.11";
}

export class GeneralReserveCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneralReserveCalculationError";
  }
}

const columns = ["constructionWorks", "installationWorks",
  "equipmentFurnitureInventory", "otherCosts"] as const;

function sums(
  values: Record<(typeof columns)[number], InstanceType<typeof Decimal>>,
): GeneralReserveAmount {
  const categories = Object.fromEntries(
    columns.map((column) => [column, toDecimalString(values[column])]),
  ) as Record<(typeof columns)[number], string>;
  return {
    ...categories,
    total: toDecimalString(columns.reduce((sum, column) =>
      sum.plus(values[column]), new Decimal(0))),
  };
}

export function calculateGeneralReserve(
  totals: ProfessionalGeneralEstimateTotals,
  category: GeneralReserveCategory,
): GeneralReserveResult {
  if (!Object.prototype.hasOwnProperty.call(GENERAL_RESERVE_RATES, category)) {
    throw new GeneralReserveCalculationError("Categoria rezervei trebuie selectată explicit.");
  }
  const rate = GENERAL_RESERVE_RATES[category].percent;
  const baseValues = Object.fromEntries(columns.map((column) =>
    [column, parseDecimal(totals.totals[column], column)],
  )) as Record<(typeof columns)[number], InstanceType<typeof Decimal>>;
  if (columns.some((column) => baseValues[column].isNegative())) {
    throw new GeneralReserveCalculationError("Baza rezervei nu poate conține sume negative.");
  }
  const base = sums(baseValues);
  if (new Decimal(base.total).eq(parseDecimal(totals.totals.total, "total")) === false) {
    throw new GeneralReserveCalculationError("Totalul capitolelor 1–12 nu corespunde coloanelor.");
  }
  const reserveValues = Object.fromEntries(columns.map((column) =>
    [column, baseValues[column].mul(rate).div(100)],
  )) as Record<(typeof columns)[number], InstanceType<typeof Decimal>>;
  const withReserveValues = Object.fromEntries(columns.map((column) =>
    [column, baseValues[column].plus(reserveValues[column])],
  )) as Record<(typeof columns)[number], InstanceType<typeof Decimal>>;
  return {
    category, ratePercent: rate, base,
    reserve: sums(reserveValues),
    withReserve: sums(withReserveValues),
    sourceReference: "CP L.01.01-2012, pct. 6.11",
  };
}
