import type { DecimalFormat } from "@/domain/catalog/money";
import type { CatalogItemType, SupportedUnit } from "@/domain/shared/types";
import type { MappedRow } from "@/domain/catalog/import.service";

// Shared types for the import flow. Kept out of the "use server" actions file
// because a server-actions module may only export async functions.

export type ParseResult =
  | { status: "needs_sheet"; sheets: string[] }
  | { status: "parsed"; headers: string[]; rows: string[][] }
  | { status: "error"; error: string };

export interface ImportPayload {
  rows: MappedRow[];
  decimalFormat: DecimalFormat;
  unitMapping: Record<string, SupportedUnit>;
  defaultItemType: CatalogItemType;
}

export interface ImportPreview {
  totalRows: number;
  createCount: number;
  updateCount: number;
  errorRows: { rowNumber: number; errors: string[] }[];
  newCategoryNames: string[];
}

export interface ImportResult {
  created: number;
  updated: number;
  skippedUpdates: number;
  errors: number;
}
