import {
  Decimal,
  DecimalParseError,
  parseDecimal,
  toDecimalString,
} from "./decimal";
import type {
  ProfessionalGeneralEstimateChapterTotals,
  ProfessionalGeneralEstimateTotals,
} from "./general-estimate";

/**
 * General-estimate valuation only (NCM L.02.06-2012, 4.1-4.2).
 * Contractual settlement by measured negative-temperature days (4.3) is a
 * different calculation and must never be folded into this one.
 */
export type WinterPeriod =
  | { kind: "annual_average" }
  | {
      kind: "short_project";
      durationDays: string;
      winterDays: string;
      projectReference: string;
    };

export interface WinterConditionsBase {
  construction: string;
  installation: string;
  combined: string;
}

export interface WinterConditionsResult {
  baseConstruction: string;
  baseInstallation: string;
  baseCombined: string;
  ratePercent: string;
  period: WinterPeriod;
  coefficient: string;
  winterConstruction: string;
  winterInstallation: string;
  winterTotal: string;
}

export class WinterConditionsCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WinterConditionsCalculationError";
  }
}

function nonNegative(value: string, field: string) {
  try {
    const decimal = parseDecimal(value, field);
    if (decimal.isNegative()) {
      throw new WinterConditionsCalculationError(field + " must not be negative.");
    }
    return decimal;
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new WinterConditionsCalculationError(error.message);
    }
    throw error;
  }
}

function positive(value: string, field: string) {
  const decimal = nonNegative(value, field);
  if (decimal.isZero()) {
    throw new WinterConditionsCalculationError(field + " must be greater than zero.");
  }
  return decimal;
}

function wholeDays(value: string, field: string, allowZero: boolean) {
  const decimal = nonNegative(value, field);
  if (!decimal.isInteger() || (!allowZero && decimal.isZero())) {
    throw new WinterConditionsCalculationError(field + " must be a valid whole-day count.");
  }
  return decimal;
}

/** No implied calendar or climate values: the project supplies the days. */
export function winterPeriodCoefficient(period: WinterPeriod): string {
  if (period.kind === "annual_average") {
    return "1";
  }
  if (period.kind !== "short_project" || !period.projectReference.trim()) {
    throw new WinterConditionsCalculationError(
      "A short-project winter calculation requires a project reference.",
    );
  }
  const duration = wholeDays(period.durationDays, "durationDays", false);
  const winter = wholeDays(period.winterDays, "winterDays", true);
  if (winter.gt(duration)) {
    throw new WinterConditionsCalculationError(
      "winterDays cannot exceed durationDays.",
    );
  }
  // NCM L.02.06-2012, pct. 4.2: K = Ptf / (D * 0.23).
  // The under-one-year classification must be validated against the project
  // schedule by the caller; a fixed 365-day threshold would be misleading.
  return toDecimalString(winter.div(duration.mul(new Decimal("0.23"))));
}

/** The Chapter 8 adjustment must already have been included in totals. */
export function calculateWinterConditionsBase(
  totals: ProfessionalGeneralEstimateTotals,
): WinterConditionsBase {
  let construction = new Decimal(0);
  let installation = new Decimal(0);

  for (let chapter = 1; chapter <= 8; chapter += 1) {
    const row = totals.chapters[
      chapter as keyof ProfessionalGeneralEstimateTotals["chapters"]
    ];
    construction = construction.plus(
      nonNegative(row.constructionWorks, "chapter" + chapter + ".constructionWorks"),
    );
    installation = installation.plus(
      nonNegative(row.installationWorks, "chapter" + chapter + ".installationWorks"),
    );
  }

  return {
    construction: toDecimalString(construction),
    installation: toDecimalString(installation),
    combined: toDecimalString(construction.plus(installation)),
  };
}

/**
 * The rate must come from an explicitly selected, eligible persisted rule.
 * Governance, rule selection and applicability checks belong in the service.
 */
export function calculateWinterConditions(input: {
  baseConstruction: string;
  baseInstallation: string;
  ratePercent: string;
  period: WinterPeriod;
}): WinterConditionsResult {
  const construction = nonNegative(input.baseConstruction, "baseConstruction");
  const installation = nonNegative(input.baseInstallation, "baseInstallation");
  const rate = positive(input.ratePercent, "ratePercent");
  const coefficient = nonNegative(
    winterPeriodCoefficient(input.period),
    "coefficient",
  );
  const factor = rate.div(100).mul(coefficient);
  const winterConstruction = construction.mul(factor);
  const winterInstallation = installation.mul(factor);

  return {
    baseConstruction: toDecimalString(construction),
    baseInstallation: toDecimalString(installation),
    baseCombined: toDecimalString(construction.plus(installation)),
    ratePercent: toDecimalString(rate),
    period: input.period,
    coefficient: toDecimalString(coefficient),
    winterConstruction: toDecimalString(winterConstruction),
    winterInstallation: toDecimalString(winterInstallation),
    winterTotal: toDecimalString(winterConstruction.plus(winterInstallation)),
  };
}

function addToChapter(
  current: ProfessionalGeneralEstimateChapterTotals,
  constructionAmount: string,
  installationAmount: string,
): ProfessionalGeneralEstimateChapterTotals {
  const constructionWorks = nonNegative(current.constructionWorks, "chapter9.constructionWorks")
    .plus(nonNegative(constructionAmount, "winterConstruction"));
  const installationWorks = nonNegative(current.installationWorks, "chapter9.installationWorks")
    .plus(nonNegative(installationAmount, "winterInstallation"));
  const equipmentFurnitureInventory = nonNegative(
    current.equipmentFurnitureInventory,
    "chapter9.equipmentFurnitureInventory",
  );
  const otherCosts = nonNegative(current.otherCosts, "chapter9.otherCosts");

  return {
    constructionWorks: toDecimalString(constructionWorks),
    installationWorks: toDecimalString(installationWorks),
    equipmentFurnitureInventory: toDecimalString(equipmentFurnitureInventory),
    otherCosts: toDecimalString(otherCosts),
    total: toDecimalString(
      constructionWorks.plus(installationWorks)
        .plus(equipmentFurnitureInventory).plus(otherCosts),
    ),
  };
}

/** Adds winter costs to Chapter 9, columns 4/5/8, without mutating input. */
export function applyWinterConditionsToGeneralEstimate(
  totalsAfterTemporaryWorks: ProfessionalGeneralEstimateTotals,
  winter: WinterConditionsResult,
): ProfessionalGeneralEstimateTotals {
  const actualBase = calculateWinterConditionsBase(totalsAfterTemporaryWorks);
  if (
    !nonNegative(actualBase.construction, "actualBaseConstruction").eq(winter.baseConstruction) ||
    !nonNegative(actualBase.installation, "actualBaseInstallation").eq(winter.baseInstallation)
  ) {
    throw new WinterConditionsCalculationError(
      "The winter calculation is stale: chapters 1-8 changed.",
    );
  }

  const extraConstruction = nonNegative(winter.winterConstruction, "winterConstruction");
  const extraInstallation = nonNegative(winter.winterInstallation, "winterInstallation");
  if (!extraConstruction.plus(extraInstallation).eq(winter.winterTotal)) {
    throw new WinterConditionsCalculationError("Winter cost components do not match their total.");
  }

  const existing = totalsAfterTemporaryWorks.totals;
  const constructionWorks = nonNegative(existing.constructionWorks, "constructionWorks")
    .plus(extraConstruction);
  const installationWorks = nonNegative(existing.installationWorks, "installationWorks")
    .plus(extraInstallation);
  const equipmentFurnitureInventory = nonNegative(
    existing.equipmentFurnitureInventory, "equipmentFurnitureInventory",
  );
  const otherCosts = nonNegative(existing.otherCosts, "otherCosts");

  return {
    currency: totalsAfterTemporaryWorks.currency,
    chapters: {
      ...totalsAfterTemporaryWorks.chapters,
      9: addToChapter(
        totalsAfterTemporaryWorks.chapters[9],
        winter.winterConstruction,
        winter.winterInstallation,
      ),
    },
    totals: {
      constructionWorks: toDecimalString(constructionWorks),
      installationWorks: toDecimalString(installationWorks),
      equipmentFurnitureInventory: toDecimalString(equipmentFurnitureInventory),
      otherCosts: toDecimalString(otherCosts),
      total: toDecimalString(
        constructionWorks.plus(installationWorks)
          .plus(equipmentFurnitureInventory).plus(otherCosts),
      ),
    },
  };
}
