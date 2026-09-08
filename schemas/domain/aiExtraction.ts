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

// A finite positive measurement in metres, or null when not stated.
const dimensionSchema = z
  .union([z.number(), z.null()])
  .refine((v) => v === null || (Number.isFinite(v) && v > 0), "Invalid dimension.");

const openingSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  count: z
    .union([z.number().int().positive(), z.null()])
    .transform((c) => c ?? 1),
});

// Optional raw dimensions for deterministic take-off. Areas are computed in
// domain code, never here and never by the AI. Absent → null (no geometry).
const geometrySchema = z
  .union([
    z.object({
      shape: z.enum(["wall_rectangle", "room_walls", "floor", "ceiling"]),
      length: dimensionSchema,
      width: dimensionSchema,
      height: dimensionSchema,
      openings: z.array(openingSchema).max(20),
    }),
    z.null(),
  ])
  .optional()
  .transform((g) => g ?? null);

const missingTargetTypeSchema = z.enum([
  "item_quantity",
  "geometry_dimension",
  "geometry_perimeter",
  "specification",
  "decision",
]);

const missingTargetKeySchema = z.enum([
  "length",
  "width",
  "height",
  "perimeter",
  "tile_size",
  "thickness_mm",
  "mount_type",
  "material_type",
  "scope_included",
  "yes_no",
]);

const missingInfoTargetSchema = z
  .object({
    type: missingTargetTypeSchema,
    key: z.union([missingTargetKeySchema, z.null()]).optional().transform((k) => k ?? null),
  })
  .superRefine((target, ctx) => {
    const has = (key: string) => target.key === key;
    if (target.type === "item_quantity" && target.key !== null) {
      ctx.addIssue({ code: "custom", message: "item_quantity must not define key." });
      return;
    }
    if (
      target.type === "geometry_dimension" &&
      !(has("length") || has("width") || has("height"))
    ) {
      ctx.addIssue({ code: "custom", message: "geometry_dimension key must be length/width/height." });
      return;
    }
    if (target.type === "geometry_perimeter" && !has("perimeter")) {
      ctx.addIssue({ code: "custom", message: "geometry_perimeter key must be perimeter." });
      return;
    }
    if (
      target.type === "specification" &&
      !(has("tile_size") || has("thickness_mm") || has("mount_type") || has("material_type"))
    ) {
      ctx.addIssue({ code: "custom", message: "specification key is invalid." });
      return;
    }
    if (
      target.type === "decision" &&
      !(has("scope_included") || has("yes_no"))
    ) {
      ctx.addIssue({ code: "custom", message: "decision key is invalid." });
    }
  });

const missingInfoOptionSchema = z.object({
  value: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
});

export const missingInformationFieldSchema = z.object({
  label: z.string().trim().min(1).max(200),
  question: z.string().trim().min(1).max(400),
  relatedItemIndex: z
    .union([z.number().int().min(0), z.null()])
    .optional()
    .transform((v) => v ?? null),
  target: missingInfoTargetSchema,
  inputType: z.enum(["number", "select", "boolean", "text"]),
  unit: z.union([z.string().trim().min(1).max(24), z.null()]).optional().transform((v) => v ?? null),
  options: z.array(missingInfoOptionSchema).max(20).optional().transform((v) => v ?? []),
  required: z.boolean(),
});

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
  // Explicit non-priceable scope attributes (e.g. "double boarding", "both
  // sides"). Optional for backward compatibility; capped at 20.
  specifications: z
    .array(z.string().trim().min(1).max(160))
    .max(20)
    .optional()
    .transform((s) => s ?? []),
  geometry: geometrySchema,
});

export const jobExtractionSchema = z.object({
  detectedLanguage: detectedLanguageSchema,
  items: z.array(extractedItemSchema).max(100),
  assumptions: z.array(z.string().trim().max(500)).max(50),
  // New structured, actionable missing-information entries.
  missingInformation: z.array(missingInformationFieldSchema).max(50),
  // Legacy fallback channel: plain text notes (informational only).
  missingInformationText: z
    .array(z.string().trim().max(500))
    .max(50)
    .optional()
    .transform((v) => v ?? []),
});

export type JobExtractionParsed = z.infer<typeof jobExtractionSchema>;
