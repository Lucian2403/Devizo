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

export const TEMPORARY_WORKS_PROJECT_CONDITIONS = [
  {
    value: "standard",
    label: "Construcție standard",
    coefficient: "1",
    sourceReference: "NCM L.02.05-2012, pct. 4.1–4.2",
  },
  {
    value: "reconstruction_or_extension_operating_facility",
    label: "Reconstrucție / extindere la întreprindere, clădire sau construcție în funcțiune",
    coefficient: "0.8",
    sourceReference: "NCM L.02.05-2012, pct. 4.3",
  },
  {
    value: "road_reconstruction",
    label: "Reconstrucție drum auto",
    coefficient: "0.8",
    sourceReference: "NCM L.02.05-2012, pct. 4.3",
  },
  {
    value: "capital_repair_complex",
    label: "Reparație capitală complexă",
    coefficient: "1",
    sourceReference: "NCM L.02.05-2012, pct. 4.4",
  },
  {
    value: "capital_repair_selective",
    label: "Reparație capitală selectivă",
    coefficient: "0.5",
    sourceReference: "NCM L.02.05-2012, pct. 4.4",
  },
] as const;

export type TemporaryWorksProjectCondition =
  (typeof TEMPORARY_WORKS_PROJECT_CONDITIONS)[number]["value"];

export type TemporaryWorksMode =
  | "normative_rate"
  | "project_calculation"
  | "zero_base";

export interface TemporaryWorksBase {
  construction: string;
  installation: string;
  combined: string;
}

export interface TemporaryWorksResult {
  mode: TemporaryWorksMode;
  baseConstruction: string;
  baseInstallation: string;
  baseCombined: string;
  ratePercent: string | null;
  projectCondition: TemporaryWorksProjectCondition | null;
  coefficient: string | null;
  temporaryConstruction: string;
  temporaryInstallation: string;
  temporaryTotal: string;
  recoverableRatePercent: "15";
  recoverableAmount: string;
}

export class TemporaryWorksCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemporaryWorksCalculationError";
  }
}

function nonNegativeDecimal(value: string, field: string) {
  try {
    const parsed = parseDecimal(value, field);
    if (parsed.isNegative()) {
      throw new TemporaryWorksCalculationError(
        `${field} must not be negative.`,
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof DecimalParseError) {
      throw new TemporaryWorksCalculationError(error.message);
    }
    throw error;
  }
}

function positiveDecimal(value: string, field: string) {
  const parsed = nonNegativeDecimal(value, field);
  if (parsed.isZero()) {
    throw new TemporaryWorksCalculationError(`${field} must be greater than zero.`);
  }
  return parsed;
}

export function temporaryWorksCoefficient(
  condition: TemporaryWorksProjectCondition,
): string {
  const match = TEMPORARY_WORKS_PROJECT_CONDITIONS.find(
    (item) => item.value === condition,
  );
  if (!match) {
    throw new TemporaryWorksCalculationError(
      "Project condition is not supported by NCM L.02.05-2012.",
    );
  }
  return match.coefficient;
}

export function calculateTemporaryWorksBase(
  totals: ProfessionalGeneralEstimateTotals,
): TemporaryWorksBase {
  let construction = new Decimal(0);
  let installation = new Decimal(0);

  for (let chapter = 1; chapter <= 7; chapter += 1) {
    const row = totals.chapters[
      chapter as keyof ProfessionalGeneralEstimateTotals["chapters"]
    ];
    construction = construction.plus(
      nonNegativeDecimal(row.constructionWorks, `chapter${chapter}.constructionWorks`),
    );
    installation = installation.plus(
      nonNegativeDecimal(row.installationWorks, `chapter${chapter}.installationWorks`),
    );
  }

  return {
    construction: toDecimalString(construction),
    installation: toDecimalString(installation),
    combined: toDecimalString(construction.plus(installation)),
  };
}

export function calculateTemporaryWorks(input: {
  baseConstruction: string;
  baseInstallation: string;
  ratePercent: string;
  projectCondition: TemporaryWorksProjectCondition;
}): TemporaryWorksResult {
  const baseConstruction = nonNegativeDecimal(
    input.baseConstruction,
    "baseConstruction",
  );
  const baseInstallation = nonNegativeDecimal(
    input.baseInstallation,
    "baseInstallation",
  );
  const rate = positiveDecimal(input.ratePercent, "ratePercent");
  const coefficient = positiveDecimal(
    temporaryWorksCoefficient(input.projectCondition),
    "coefficient",
  );
  const factor = rate.div(100).mul(coefficient);
  const temporaryConstruction = baseConstruction.mul(factor);
  const temporaryInstallation = baseInstallation.mul(factor);
  const temporaryTotal = temporaryConstruction.plus(temporaryInstallation);

  return serializeResult({
    mode: "normative_rate",
    baseConstruction,
    baseInstallation,
    ratePercent: rate,
    projectCondition: input.projectCondition,
    coefficient,
    temporaryConstruction,
    temporaryInstallation,
  });
}

export function calculateProjectTemporaryWorks(input: {
  baseConstruction: string;
  baseInstallation: string;
  projectConstructionAmount: string;
  projectInstallationAmount: string;
}): TemporaryWorksResult {
  const baseConstruction = nonNegativeDecimal(
    input.baseConstruction,
    "baseConstruction",
  );
  const baseInstallation = nonNegativeDecimal(
    input.baseInstallation,
    "baseInstallation",
  );
  const temporaryConstruction = nonNegativeDecimal(
    input.projectConstructionAmount,
    "projectConstructionAmount",
  );
  const temporaryInstallation = nonNegativeDecimal(
    input.projectInstallationAmount,
    "projectInstallationAmount",
  );
  if (temporaryConstruction.plus(temporaryInstallation).isZero()) {
    throw new TemporaryWorksCalculationError(
      "Project calculation must contain a positive construction or installation amount.",
    );
  }

  return serializeResult({
    mode: "project_calculation",
    baseConstruction,
    baseInstallation,
    ratePercent: null,
    projectCondition: null,
    coefficient: null,
    temporaryConstruction,
    temporaryInstallation,
  });
}

export function calculateZeroTemporaryWorks(
  base: TemporaryWorksBase,
): TemporaryWorksResult {
  const construction = nonNegativeDecimal(base.construction, "baseConstruction");
  const installation = nonNegativeDecimal(base.installation, "baseInstallation");
  if (!construction.plus(installation).isZero()) {
    throw new TemporaryWorksCalculationError(
      "Zero-base result requires a zero chapters 1–7 construction and installation base.",
    );
  }
  return serializeResult({
    mode: "zero_base",
    baseConstruction: construction,
    baseInstallation: installation,
    ratePercent: null,
    projectCondition: null,
    coefficient: null,
    temporaryConstruction: new Decimal(0),
    temporaryInstallation: new Decimal(0),
  });
}

function serializeResult(input: {
  mode: TemporaryWorksMode;
  baseConstruction: InstanceType<typeof Decimal>;
  baseInstallation: InstanceType<typeof Decimal>;
  ratePercent: InstanceType<typeof Decimal> | null;
  projectCondition: TemporaryWorksProjectCondition | null;
  coefficient: InstanceType<typeof Decimal> | null;
  temporaryConstruction: InstanceType<typeof Decimal>;
  temporaryInstallation: InstanceType<typeof Decimal>;
}): TemporaryWorksResult {
  const temporaryTotal = input.temporaryConstruction.plus(
    input.temporaryInstallation,
  );
  return {
    mode: input.mode,
    baseConstruction: toDecimalString(input.baseConstruction),
    baseInstallation: toDecimalString(input.baseInstallation),
    baseCombined: toDecimalString(
      input.baseConstruction.plus(input.baseInstallation),
    ),
    ratePercent:
      input.ratePercent === null ? null : toDecimalString(input.ratePercent),
    projectCondition: input.projectCondition,
    coefficient:
      input.coefficient === null ? null : toDecimalString(input.coefficient),
    temporaryConstruction: toDecimalString(input.temporaryConstruction),
    temporaryInstallation: toDecimalString(input.temporaryInstallation),
    temporaryTotal: toDecimalString(temporaryTotal),
    recoverableRatePercent: "15",
    recoverableAmount: toDecimalString(temporaryTotal.mul("0.15")),
  };
}

function addCategory(
  row: ProfessionalGeneralEstimateChapterTotals,
  construction: string,
  installation: string,
): ProfessionalGeneralEstimateChapterTotals {
  const constructionWorks = nonNegativeDecimal(
    row.constructionWorks,
    "chapter8.constructionWorks",
  ).plus(nonNegativeDecimal(construction, "temporaryConstruction"));
  const installationWorks = nonNegativeDecimal(
    row.installationWorks,
    "chapter8.installationWorks",
  ).plus(nonNegativeDecimal(installation, "temporaryInstallation"));
  const equipment = nonNegativeDecimal(
    row.equipmentFurnitureInventory,
    "chapter8.equipmentFurnitureInventory",
  );
  const other = nonNegativeDecimal(row.otherCosts, "chapter8.otherCosts");

  return {
    constructionWorks: toDecimalString(constructionWorks),
    installationWorks: toDecimalString(installationWorks),
    equipmentFurnitureInventory: toDecimalString(equipment),
    otherCosts: toDecimalString(other),
    total: toDecimalString(
      constructionWorks.plus(installationWorks).plus(equipment).plus(other),
    ),
  };
}

export function applyTemporaryWorksToGeneralEstimate(
  totals: ProfessionalGeneralEstimateTotals,
  temporaryWorks: TemporaryWorksResult,
): ProfessionalGeneralEstimateTotals {
  const chapters = {
    ...totals.chapters,
    8: addCategory(
      totals.chapters[8],
      temporaryWorks.temporaryConstruction,
      temporaryWorks.temporaryInstallation,
    ),
  };

  const constructionWorks = nonNegativeDecimal(
    totals.totals.constructionWorks,
    "totals.constructionWorks",
  ).plus(
    nonNegativeDecimal(
      temporaryWorks.temporaryConstruction,
      "temporaryConstruction",
    ),
  );
  const installationWorks = nonNegativeDecimal(
    totals.totals.installationWorks,
    "totals.installationWorks",
  ).plus(
    nonNegativeDecimal(
      temporaryWorks.temporaryInstallation,
      "temporaryInstallation",
    ),
  );
  const equipment = nonNegativeDecimal(
    totals.totals.equipmentFurnitureInventory,
    "totals.equipmentFurnitureInventory",
  );
  const other = nonNegativeDecimal(totals.totals.otherCosts, "totals.otherCosts");

  return {
    currency: totals.currency,
    chapters,
    totals: {
      constructionWorks: toDecimalString(constructionWorks),
      installationWorks: toDecimalString(installationWorks),
      equipmentFurnitureInventory: toDecimalString(equipment),
      otherCosts: toDecimalString(other),
      total: toDecimalString(
        constructionWorks.plus(installationWorks).plus(equipment).plus(other),
      ),
    },
  };
}
