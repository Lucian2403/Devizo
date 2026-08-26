import type { CatalogItemId } from "@/domain/shared/types";
import type { SupportedUnit } from "@/domain/shared/types";
import type { CatalogItemData } from "./item.repository";
import { normalizePrice, isNonNegative, type DecimalFormat } from "./money";
import { isSupportedUnit } from "./units";

// MVP import limits.
export const IMPORT_LIMITS = {
  maxBytes: 10 * 1024 * 1024, // 10 MB
  maxRows: 5000,
};

// The catalog fields an uploaded column can be mapped to.
export const IMPORT_FIELDS = [
  "code",
  "name",
  "description",
  "unit",
  "sellingPrice",
  "costPrice",
  "category",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

// One row after the user's column mapping was applied: field -> raw cell text.
export type MappedRow = Partial<Record<ImportField, string>>;

// Everything the validator needs that comes from outside the pure logic.
export interface ImportContext {
  decimalFormat: DecimalFormat;
  // Raw unit text (lowercased) -> canonical unit chosen by the user.
  unitMapping: Record<string, SupportedUnit>;
  // Existing item codes in the org -> their id, for update matching.
  existingCodeToId: Map<string, CatalogItemId>;
}

// A validated row carries either resolved data or a list of errors.
export interface ValidatedRow {
  rowNumber: number;
  errors: string[];
  // The category is resolved to a real id later (find-or-create on confirm).
  categoryName: string | null;
  matchedItemId: CatalogItemId | null;
  data: CatalogItemData | null;
}

export interface ImportValidationResult {
  totalRows: number;
  toCreate: ValidatedRow[];
  toUpdate: ValidatedRow[]; // rows whose code matched an existing item
  errors: ValidatedRow[];
}

/**
 * Validates mapped rows deterministically. AI is never involved.
 * - prices are normalized using the explicitly chosen decimal format
 * - units must resolve to a canonical unit via the provided mapping
 * - rows whose code matches an existing item become update candidates
 * - duplicate codes inside the same file are reported as errors
 */
export function validateImportRows(
  rows: MappedRow[],
  context: ImportContext,
): ImportValidationResult {
  const toCreate: ValidatedRow[] = [];
  const toUpdate: ValidatedRow[] = [];
  const errors: ValidatedRow[] = [];

  // Track codes seen in this file to catch in-file duplicates.
  const seenCodes = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const rowErrors: string[] = [];

    const name = (row.name ?? "").trim();
    if (name === "") rowErrors.push("Name is required.");

    const code = (row.code ?? "").trim() || null;
    if (code) {
      const key = code.toLowerCase();
      if (seenCodes.has(key)) {
        rowErrors.push(`Duplicate code "${code}" within the file.`);
      }
      seenCodes.add(key);
    }

    // Unit: resolve raw text through the user's mapping or accept a canonical.
    const rawUnit = (row.unit ?? "").trim();
    let unit: SupportedUnit | null = null;
    if (rawUnit === "") {
      rowErrors.push("Unit is required.");
    } else {
      const mapped = context.unitMapping[rawUnit.toLowerCase()];
      if (mapped) {
        unit = mapped;
      } else if (isSupportedUnit(rawUnit)) {
        unit = rawUnit;
      } else {
        rowErrors.push(`Unit "${rawUnit}" is not mapped to a known unit.`);
      }
    }

    // Selling price required and non-negative.
    const sellingPrice = normalizePrice(row.sellingPrice ?? "", context.decimalFormat);
    if (sellingPrice === null) {
      rowErrors.push("Selling price is required and must be a valid number.");
    } else if (!isNonNegative(sellingPrice)) {
      rowErrors.push("Selling price cannot be negative.");
    }

    // Cost price optional; when present it must be valid and non-negative.
    let costPrice: string | null = null;
    const rawCost = (row.costPrice ?? "").trim();
    if (rawCost !== "") {
      const parsed = normalizePrice(rawCost, context.decimalFormat);
      if (parsed === null || !isNonNegative(parsed)) {
        rowErrors.push("Cost price must be a valid non-negative number.");
      } else {
        costPrice = parsed;
      }
    }

    const categoryName = (row.category ?? "").trim() || null;
    const description = (row.description ?? "").trim() || null;

    if (rowErrors.length > 0) {
      errors.push({
        rowNumber,
        errors: rowErrors,
        categoryName,
        matchedItemId: null,
        data: null,
      });
      return;
    }

    const data: CatalogItemData = {
      code,
      name,
      description,
      unit: unit!,
      sellingPrice: sellingPrice!,
      costPrice,
      active: true,
    };

    const matchedItemId = code
      ? context.existingCodeToId.get(code.toLowerCase()) ?? null
      : null;

    const validated: ValidatedRow = {
      rowNumber,
      errors: [],
      categoryName,
      matchedItemId,
      data,
    };

    if (matchedItemId) toUpdate.push(validated);
    else toCreate.push(validated);
  });

  return {
    totalRows: rows.length,
    toCreate,
    toUpdate,
    errors,
  };
}
