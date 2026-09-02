"use server";

import Papa from "papaparse";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getCatalogCategoryService,
  getCatalogItemService,
  getCatalogItemRepository,
  syncCatalogEmbeddings,
} from "@/server/container";
import type { CatalogItemId } from "@/domain/shared/types";
import {
  IMPORT_LIMITS,
  validateImportRows,
} from "@/domain/catalog/import.service";
import type {
  ImportPayload,
  ImportPreview,
  ImportResult,
  ParseResult,
} from "./types";

// --- Parsing (upload -> rows) --------------------------------------------

// Coerces any spreadsheet cell value to a trimmed string.
function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // ExcelJS rich objects (formulas, hyperlinks, rich text).
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("text" in v) return String(v.text).trim();
    if ("result" in v) return String(v.result).trim();
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => (r as { text: string }).text).join("").trim();
    }
  }
  return String(value).trim();
}

function splitHeaderAndRows(matrix: string[][]): ParseResult {
  const nonEmpty = matrix.filter((row) => row.some((cell) => cell !== ""));
  if (nonEmpty.length === 0) {
    return { status: "error", error: "Fișierul nu conține date." };
  }
  const headers = nonEmpty[0]!;
  const rows = nonEmpty.slice(1);
  if (rows.length > IMPORT_LIMITS.maxRows) {
    return {
      status: "error",
      error: `Prea multe rânduri: ${rows.length}. Limita este ${IMPORT_LIMITS.maxRows}.`,
    };
  }
  return { status: "parsed", headers, rows };
}

export async function parseUpload(formData: FormData): Promise<ParseResult> {
  await requireCurrentOrg();

  const file = formData.get("file");
  const sheetName = formData.get("sheet");

  if (!(file instanceof File)) {
    return { status: "error", error: "Niciun fișier încărcat." };
  }
  if (file.size > IMPORT_LIMITS.maxBytes) {
    return { status: "error", error: "Fișierul este mai mare de 10 MB." };
  }

  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv");
  const isXlsx = name.endsWith(".xlsx");
  if (!isCsv && !isXlsx) {
    return { status: "error", error: "Sunt acceptate doar fișiere CSV și XLSX." };
  }

  try {
    if (isCsv) {
      const text = await file.text();
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      const matrix = parsed.data.map((row) => row.map((c) => String(c).trim()));
      return splitHeaderAndRows(matrix);
    }

    // XLSX
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheetNames = workbook.worksheets.map((ws) => ws.name);

    if (sheetNames.length === 0) {
      return { status: "error", error: "Registrul nu are foi." };
    }
    // Multiple sheets require an explicit choice.
    const chosen = typeof sheetName === "string" && sheetName ? sheetName : null;
    if (sheetNames.length > 1 && !chosen) {
      return { status: "needs_sheet", sheets: sheetNames };
    }

    const worksheet = chosen
      ? workbook.getWorksheet(chosen)
      : workbook.worksheets[0];
    if (!worksheet) {
      return { status: "error", error: "Foaia selectată nu a fost găsită." };
    }

    const matrix: string[][] = [];
    worksheet.eachRow((row) => {
      // row.values is 1-indexed; drop the leading empty slot.
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      matrix.push(values.map(cellToString));
    });
    return splitHeaderAndRows(matrix);
  } catch {
    return { status: "error", error: "Fișierul nu a putut fi citit." };
  }
}

// --- Validation & import --------------------------------------------------

// Loads existing item codes for update matching (code lowercased -> id).
async function loadExistingCodes(
  organizationId: string,
): Promise<Map<string, CatalogItemId>> {
  const items = await getCatalogItemService().listItems(organizationId);
  const map = new Map<string, CatalogItemId>();
  for (const item of items) {
    if (item.code) map.set(item.code.toLowerCase(), item.id);
  }
  return map;
}

export async function validateImport(
  payload: ImportPayload,
): Promise<ImportPreview> {
  const { org } = await requireCurrentOrg();

  if (payload.rows.length > IMPORT_LIMITS.maxRows) {
    return {
      totalRows: payload.rows.length,
      createCount: 0,
      updateCount: 0,
      errorRows: [
        { rowNumber: 0, errors: [`Prea multe rânduri (limita ${IMPORT_LIMITS.maxRows}).`] },
      ],
      newCategoryNames: [],
    };
  }

  const existingCodeToId = await loadExistingCodes(org.id);
  const result = validateImportRows(payload.rows, {
    decimalFormat: payload.decimalFormat,
    unitMapping: payload.unitMapping,
    defaultItemType: payload.defaultItemType,
    existingCodeToId,
  });

  // Which category names are not present yet (would be created on confirm).
  const categories = await getCatalogCategoryService().listCategories(org.id);
  const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
  const newCategoryNames = new Set<string>();
  for (const row of [...result.toCreate, ...result.toUpdate]) {
    if (row.categoryName && !existingNames.has(row.categoryName.toLowerCase())) {
      newCategoryNames.add(row.categoryName);
    }
  }

  return {
    totalRows: result.totalRows,
    createCount: result.toCreate.length,
    updateCount: result.toUpdate.length,
    errorRows: result.errors.map((r) => ({
      rowNumber: r.rowNumber,
      errors: r.errors,
    })),
    newCategoryNames: [...newCategoryNames],
  };
}

export async function runImport(
  payload: ImportPayload & { applyUpdates: boolean; createCategories: boolean },
): Promise<ImportResult> {
  const { org } = await requireCurrentOrg();

  // Never trust the client: re-validate on the server before writing anything.
  const existingCodeToId = await loadExistingCodes(org.id);
  const result = validateImportRows(payload.rows, {
    decimalFormat: payload.decimalFormat,
    unitMapping: payload.unitMapping,
    defaultItemType: payload.defaultItemType,
    existingCodeToId,
  });

  // Build a name -> id map of categories, creating missing ones if allowed.
  const categories = await getCatalogCategoryService().listCategories(org.id);
  const nameToId = new Map<string, string>();
  for (const c of categories) nameToId.set(c.name.toLowerCase(), c.id);

  async function resolveCategory(name: string | null): Promise<string | null> {
    if (!name) return null;
    const key = name.toLowerCase();
    const existing = nameToId.get(key);
    if (existing) return existing;
    if (!payload.createCategories) return null;
    const created = await getCatalogCategoryService().createCategory(org.id, name);
    nameToId.set(key, created.id);
    return created.id;
  }

  const creates = [];
  for (const row of result.toCreate) {
    const categoryId = await resolveCategory(row.categoryName);
    creates.push({ ...row.data!, categoryId });
  }

  const updates: { id: CatalogItemId; data: (typeof result.toUpdate)[number]["data"] }[] =
    [];
  if (payload.applyUpdates) {
    for (const row of result.toUpdate) {
      const categoryId = await resolveCategory(row.categoryName);
      updates.push({ id: row.matchedItemId!, data: { ...row.data!, categoryId } });
    }
  }

  const outcome = await getCatalogItemRepository().bulkUpsert(
    org.id,
    creates,
    updates.map((u) => ({ id: u.id, data: u.data! })),
  );

  // Best-effort: embed new/changed rows after the data commit. A failure here
  // never rolls back the import; unembedded rows are picked up on next sync.
  await syncCatalogEmbeddings(org.id);

  revalidatePath("/catalog");
  return {
    created: outcome.created,
    updated: outcome.updated,
    skippedUpdates: payload.applyUpdates ? 0 : result.toUpdate.length,
    errors: result.errors.length,
  };
}
