import {
  Decimal,
  parseDecimal,
  toDecimalString,
  type DecimalValue,
} from "./decimal";
import type { SupportedCurrency } from "@/domain/shared/types";

export const PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS = [
  {
    number: 1,
    label: "Pregătirea terenului pentru construirea obiectivului",
  },
  { number: 2, label: "Obiectivul investiții de bază" },
  { number: 3, label: "Obiecte auxiliare și de deservire" },
  { number: 4, label: "Obiecte energetice" },
  { number: 5, label: "Obiecte de comunicații și transport" },
  {
    number: 6,
    label:
      "Construcții inginerești și rețele exterioare de apă, canalizare, termice și gaze",
  },
  { number: 7, label: "Amenajarea terenului" },
  { number: 8, label: "Organizarea construcțiilor" },
  { number: 9, label: "Alte cheltuieli" },
  { number: 10, label: "Întreținerea direcției / supravegherea tehnică" },
  { number: 11, label: "Pregătirea personalului de exploatare" },
  {
    number: 12,
    label: "Lucrări de proiectări, prospectări, controlul de autor",
  },
] as const;

export type ProfessionalGeneralEstimateChapterNumber =
  (typeof PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS)[number]["number"];

export interface ProfessionalGeneralEstimateChapterTotals {
  constructionWorks: string;
  installationWorks: string;
  equipmentFurnitureInventory: string;
  otherCosts: string;
  total: string;
}

export interface ProfessionalGeneralEstimateTotals {
  chapters: Record<
    ProfessionalGeneralEstimateChapterNumber,
    ProfessionalGeneralEstimateChapterTotals
  >;
  totals: ProfessionalGeneralEstimateChapterTotals;
  currency: SupportedCurrency;
}

export interface ProfessionalGeneralEstimateAggregationEntry {
  objectEstimateId: string;
  chapterNumber: number;
  constructionWorks: string;
  installationWorks: string;
  equipmentFurnitureInventory: string;
  otherCosts: string;
  currency: SupportedCurrency;
}

export class ProfessionalGeneralEstimateAggregationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfessionalGeneralEstimateAggregationError";
  }
}

const categoryKeys = [
  "constructionWorks",
  "installationWorks",
  "equipmentFurnitureInventory",
  "otherCosts",
] as const;
type CategoryKey = (typeof categoryKeys)[number];

function emptyAmounts(): Record<CategoryKey, DecimalValue> {
  return {
    constructionWorks: new Decimal(0),
    installationWorks: new Decimal(0),
    equipmentFurnitureInventory: new Decimal(0),
    otherCosts: new Decimal(0),
  };
}

function serializeAmounts(
  values: Record<CategoryKey, DecimalValue>,
): ProfessionalGeneralEstimateChapterTotals {
  const categories = {
    constructionWorks: toDecimalString(values.constructionWorks),
    installationWorks: toDecimalString(values.installationWorks),
    equipmentFurnitureInventory: toDecimalString(
      values.equipmentFurnitureInventory,
    ),
    otherCosts: toDecimalString(values.otherCosts),
  };
  return {
    ...categories,
    total: toDecimalString(
      values.constructionWorks
        .plus(values.installationWorks)
        .plus(values.equipmentFurnitureInventory)
        .plus(values.otherCosts),
    ),
  };
}

export function calculateProfessionalGeneralEstimate(
  entries: readonly ProfessionalGeneralEstimateAggregationEntry[],
): ProfessionalGeneralEstimateTotals {
  const currency = entries[0]?.currency ?? "MDL";
  const chapterAmounts = Object.fromEntries(
    PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.map(({ number }) => [
      number,
      emptyAmounts(),
    ]),
  ) as Record<
    ProfessionalGeneralEstimateChapterNumber,
    Record<CategoryKey, DecimalValue>
  >;
  const allAmounts = emptyAmounts();
  const seenObjectEstimates = new Set<string>();

  for (const entry of entries) {
    if (
      !PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.some(
        ({ number }) => number === entry.chapterNumber,
      )
    ) {
      throw new ProfessionalGeneralEstimateAggregationError(
        "Every object estimate requires an explicit chapter from 1 to 12.",
      );
    }
    if (entry.currency !== currency) {
      throw new ProfessionalGeneralEstimateAggregationError(
        "Object estimates with different currencies cannot be aggregated.",
      );
    }
    if (seenObjectEstimates.has(entry.objectEstimateId)) {
      throw new ProfessionalGeneralEstimateAggregationError(
        "An object estimate can appear only once in a general estimate.",
      );
    }
    seenObjectEstimates.add(entry.objectEstimateId);

    const chapter = chapterAmounts[
      entry.chapterNumber as ProfessionalGeneralEstimateChapterNumber
    ];
    for (const key of categoryKeys) {
      try {
        const amount = parseDecimal(entry[key], key);
        chapter[key] = chapter[key].plus(amount);
        allAmounts[key] = allAmounts[key].plus(amount);
      } catch (error) {
        if (error instanceof Error) {
          throw new ProfessionalGeneralEstimateAggregationError(error.message);
        }
        throw error;
      }
    }
  }

  return {
    currency,
    chapters: Object.fromEntries(
      PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.map(({ number }) => [
        number,
        serializeAmounts(chapterAmounts[number]),
      ]),
    ) as ProfessionalGeneralEstimateTotals["chapters"],
    totals: serializeAmounts(allAmounts),
  };
}
