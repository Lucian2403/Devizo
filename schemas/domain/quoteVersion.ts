import { z } from "zod";
import Decimal from "decimal.js";
import { SUPPORTED_UNITS } from "@/domain/shared/types";
import { emptyToUndefined } from "@/schemas/shared";

// A required non-negative money value, normalized to a fixed-2 string.
const money = z
  .string()
  .trim()
  .min(1, "Preț obligatoriu.")
  .refine((v) => {
    try {
      const dec = new Decimal(v);
      return dec.isFinite() && dec.gte(0);
    } catch {
      return false;
    }
  }, "Preț invalid.")
  .transform((v) => new Decimal(v).toFixed(2));

// A positive quantity with up to 3 decimals, normalized to a fixed-3 string.
const quantity = z
  .string()
  .trim()
  .min(1, "Cantitate obligatorie.")
  .refine((v) => {
    try {
      const dec = new Decimal(v);
      return dec.isFinite() && dec.gt(0);
    } catch {
      return false;
    }
  }, "Cantitate invalidă.")
  .transform((v) => new Decimal(v).toFixed(3));

// A percentage 0–100 with up to 2 decimals, normalized to a fixed-2 string.
const percent = z.preprocess(
  (v) => (emptyToUndefined(v) ?? "0"),
  z
    .string()
    .trim()
    .refine((v) => {
      try {
        const dec = new Decimal(v);
        return dec.isFinite() && dec.gte(0) && dec.lte(100);
      } catch {
        return false;
      }
    }, "Procent invalid (0–100).")
    .transform((v) => new Decimal(v).toFixed(2)),
);

// One line submitted by the editor.
export const quoteItemSchema = z.object({
  catalogItemId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  name: z.string().trim().min(1, "Denumire obligatorie.").max(200),
  description: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(1000).optional(),
  ),
  unit: z.enum(SUPPORTED_UNITS),
  unitPrice: money,
  quantity,
  discountPct: percent,
});

export type QuoteItemValues = z.infer<typeof quoteItemSchema>;

// The whole draft save payload.
export const draftUpdateSchema = z.object({
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  validityDays: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(3650).optional(),
  ),
  discountPct: percent,
  items: z.array(quoteItemSchema),
});

export type DraftUpdateValues = z.infer<typeof draftUpdateSchema>;
