import { z } from "zod";
import Decimal from "decimal.js";
import {
  CATALOG_ITEM_TYPES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_UNITS,
} from "@/domain/shared/types";
import { WORK_ACTIONS, WORK_OBJECTS } from "@/domain/ai/concepts";

/**
 * Strict validation of the AI provider's structured output. This is defense in
 * depth: even though the provider uses JSON-Schema structured outputs, we
 * re-validate here and REJECT anything malformed (the service then retries once
 * and, failing that, raises a controlled ExtractionError).
 *
 * There are deliberately no price/total fields — the AI must not touch money.
 */

// A quantity is a positive decimal string, or null when unstated. We never
// silently coerce: an invalid non-null value fails validation.
const quantitySchema = z
  .union([z.string(), z.null()])
  .refine((v) => {
    if (v === null) return true;
    const trimmed = v.trim();
    if (trimmed === "") return false;
    try {
      const dec = new Decimal(trimmed);
      return dec.isFinite() && dec.gt(0);
    } catch {
      return false;
    }
  }, "Invalid quantity.")
  .transform((v) => (v === null ? null : new Decimal(v.trim()).toString()));

// Unit must be a supported canonical unit or explicit null. An unsupported
// string is a HARD failure (no coercion), per the approved corrections.
const unitSchema = z.union([z.enum(SUPPORTED_UNITS), z.null()]);

const detectedLanguageSchema = z.union([
  z.enum(SUPPORTED_LANGUAGES),
  z.literal("unknown"),
]);

export const extractedItemSchema = z.object({
  concept: z.string().trim().min(1).max(120),
  kind: z.enum(CATALOG_ITEM_TYPES),
  action: z.enum(WORK_ACTIONS),
  object: z.union([z.enum(WORK_OBJECTS), z.null()]),
  surface: z.union([z.string().trim().max(120), z.null()]),
  normalizedConcept: z.string().trim().max(120),
  rawText: z.string().trim().max(500),
  description: z.string().trim().max(500),
  quantity: quantitySchema,
  unit: unitSchema,
  confidence: z.number().min(0).max(1),
  // Search terms are non-critical retrieval hints. If the model returns extra
  // ones we keep the first 10 rather than failing the whole extraction.
  searchTerms: z
    .array(z.string().trim().min(1).max(120))
    .transform((terms) => terms.slice(0, 10)),
});

export const jobExtractionSchema = z.object({
  detectedLanguage: detectedLanguageSchema,
  items: z.array(extractedItemSchema).max(100),
  assumptions: z.array(z.string().trim().max(500)).max(50),
  missingInformation: z.array(z.string().trim().max(500)).max(50),
});

export type JobExtractionParsed = z.infer<typeof jobExtractionSchema>;
