import { Decimal, toDecimalString } from "./decimal";

// Period-specific rate. Never silently reuse it for a later fiscal year.
export const SDNC_FISCAL_YEAR = 2026 as const;
export const SDNC_RATE_PERCENT = "0.5" as const;

export class SdncCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdncCalculationError";
  }
}

export interface SdncCalculationResult {
  fiscalYear: 2026;
  annualEligibleInvestmentMdl: string;
  ratePercent: "0.5";
  annualContributionMdl: string;
}

/** No deviz-total shortcut: the caller supplies the documented annual fiscal base. */
export function calculateSdnc2026(
  annualBase: string,
  fiscalYear: number,
): SdncCalculationResult {
  if (fiscalYear !== SDNC_FISCAL_YEAR) {
    throw new SdncCalculationError("Pentru alt an fiscal este necesară verificarea legislației.");
  }
  const value = annualBase.trim().replace(",", ".");
  if (!/^\d{1,16}(?:\.\d{1,4})?$/.test(value)) {
    throw new SdncCalculationError(
      "Baza anuală trebuie să fie un număr MDL pozitiv sau zero, cu maximum 4 zecimale.",
    );
  }
  const amount = new Decimal(value);
  if (!amount.isFinite() || amount.isNegative()) {
    throw new SdncCalculationError("Baza anuală trebuie să fie nenegativă.");
  }
  return {
    fiscalYear: SDNC_FISCAL_YEAR,
    annualEligibleInvestmentMdl: toDecimalString(amount),
    ratePercent: SDNC_RATE_PERCENT,
    annualContributionMdl: toDecimalString(amount.mul(SDNC_RATE_PERCENT).div(100)),
  };
}
