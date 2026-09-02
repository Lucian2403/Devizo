import { z } from "zod";
import Decimal from "decimal.js";
import { CATALOG_ITEM_TYPES, SUPPORTED_UNITS } from "@/domain/shared/types";
import { emptyToUndefined } from "@/schemas/shared";

// A money field entered in the manual form (HTML number input uses a dot
// decimal). Validated with decimal.js and normalized to a canonical string.
const requiredMoney = z
  .string()
  .trim()
  .min(1, "Required.")
  .refine((v) => {
    try {
      return new Decimal(v).isFinite() && new Decimal(v).gte(0);
    } catch {
      return false;
    }
  }, "Must be a valid non-negative number.")
  .transform((v) => new Decimal(v).toFixed(2));

const optionalMoney = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((v) => {
      try {
        return new Decimal(v).isFinite() && new Decimal(v).gte(0);
      } catch {
        return false;
      }
    }, "Must be a valid non-negative number.")
    .transform((v) => new Decimal(v).toFixed(2))
    .optional(),
);

export const catalogItemSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(200),
  code: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
  categoryId: z.preprocess(
    emptyToUndefined,
    z.string().uuid().optional(),
  ),
  description: z.string().trim().max(1000).optional(),
  unit: z.enum(SUPPORTED_UNITS),
  itemType: z.enum(CATALOG_ITEM_TYPES),
  sellingPrice: requiredMoney,
  costPrice: optionalMoney,
  active: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export type CatalogItemValues = z.infer<typeof catalogItemSchema>;
