import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_UNITS,
} from "@/domain/shared/types";
import { WORK_ACTIONS, WORK_OBJECTS } from "@/domain/ai/concepts";
import { CATALOG_ITEM_TYPES } from "@/domain/shared/types";
import {
  jobExtractionSchema,
  type JobExtractionParsed,
} from "@/schemas/domain/aiExtraction";
import {
  ExtractionError,
  type ExtractionContext,
  type ExtractionProvider,
} from "@/domain/ai/providers";
import type { JobExtraction } from "@/domain/ai/extraction.types";
import { chatCompletion, readOpenAIConfig, type OpenAIConfig } from "./client";

// Human names help the model detect and label languages consistently.
const LANGUAGE_NAMES: Record<string, string> = {
  ro: "Romanian",
  ru: "Russian",
  en: "English",
  it: "Italian",
  fr: "French",
  de: "German",
  es: "Spanish",
};

// The strict JSON Schema for structured outputs. Nullable fields use type
// arrays; every property is required and additionalProperties is false, as
// OpenAI structured outputs demand.
const EXTRACTION_JSON_SCHEMA = {
  name: "job_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      detectedLanguage: {
        type: "string",
        enum: [...SUPPORTED_LANGUAGES, "unknown"],
      },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            concept: { type: "string" },
            kind: { type: "string", enum: [...CATALOG_ITEM_TYPES] },
            action: { type: "string", enum: [...WORK_ACTIONS] },
            object: { type: ["string", "null"], enum: [...WORK_OBJECTS, null] },
            surface: { type: ["string", "null"] },
            normalizedConcept: { type: "string" },
            rawText: { type: "string" },
            description: { type: "string" },
            quantity: { type: ["string", "null"] },
            unit: { type: ["string", "null"], enum: [...SUPPORTED_UNITS, null] },
            confidence: { type: "number" },
            searchTerms: { type: "array", items: { type: "string" } },
          },
          required: [
            "concept",
            "kind",
            "action",
            "object",
            "surface",
            "normalizedConcept",
            "rawText",
            "description",
            "quantity",
            "unit",
            "confidence",
            "searchTerms",
          ],
        },
      },
      assumptions: { type: "array", items: { type: "string" } },
      missingInformation: { type: "array", items: { type: "string" } },
    },
    required: ["detectedLanguage", "items", "assumptions", "missingInformation"],
  },
} as const;

function buildSystemPrompt(catalogLanguage: string): string {
  const catalogName = LANGUAGE_NAMES[catalogLanguage] ?? catalogLanguage;
  const units = SUPPORTED_UNITS.join(", ");
  const actions = WORK_ACTIONS.join(", ");
  const objects = WORK_OBJECTS.join(", ");
  return [
    "You extract renovation/construction work items from a contractor's free text.",
    "The input may be in any language, or mix languages. Understand the meaning, do not translate literally.",
    "",
    "STRICT RULES:",
    "- Never invent, guess or output any prices, totals, VAT or discounts. There are no money fields.",
    "- Only extract work items that are actually described.",
    "",
    "For EACH item classify its SEMANTICS (used for safe catalog matching):",
    "- kind: 'labor' for an OPERATION/work; 'material' ONLY when the user explicitly names a product to supply (e.g. '20 m2 laminat Krono', 'vată minerală'). If unsure, prefer 'labor'. Never invent materials.",
    `- action: exactly one of [${actions}]. remove = demolish/strip/take down; install = mount/lay/build; prepare = putty/plaster/prime (glet, șpăcluire, șpacliovcă, шпаклевка); finish = paint/whitewash (vopsire, zugrăvire); repair = fix/patch; other only if none fits.`,
    `- object: exactly one of [${objects}] or null. The thing acted upon, NOT the surface. tapet/oboi/обои → wallpaper; faianță/gresie/плитка → tiles; gips-carton → drywall; șapă/стяжка → screed; glet/șpacluire → putty; vopsea → paint; laminat/parchet → flooring; priză/розетка → socket; plașă/fibră de sticlă → mesh; WC/lavoar/chiuvetă/duș/cadă → sanitaryware; țeavă/conductă/canalizare → pipe.`,
    "- surface: short context like \"wall\", \"ceiling\", \"floor\", \"bathroom\", or null.",
    "- normalizedConcept: a short language-neutral concept phrase, e.g. \"remove wallpaper from wall\".",
    "",
    `- quantity: a decimal number as a STRING (e.g. \"18\", \"20.5\"), or null if the user did not state one. Never fabricate quantities. If the amount is genuinely unknown (\"țevi noi\", \"canalizare nouă\") use null — do NOT default to 1. A single explicit object (\"WC suspendat\") may be quantity 1.`,
    `- unit: one of exactly [${units}], or null if unclear. Never output any other unit string.`,
    "- confidence: a number between 0 and 1 reflecting how sure you are about the item.",
    `- searchTerms: 1-6 short catalog lookup terms translated into ${catalogName} (the company's catalog language). Use the real catalog word for the object plus synonyms.`,
    "- description: a short human description of the item in the detected input language.",
    "- assumptions: anything you inferred. missingInformation: what the contractor should clarify.",
  ].join("\n");
}

/**
 * OpenAI-backed extraction provider. Uses strict Structured Outputs and
 * re-validates with Zod. On invalid output it retries once, then raises a
 * controlled ExtractionError.
 */
export class OpenAIExtractionProvider implements ExtractionProvider {
  private readonly config: OpenAIConfig;

  constructor(config?: OpenAIConfig) {
    this.config = config ?? readOpenAIConfig();
  }

  async extract(
    text: string,
    context: ExtractionContext,
  ): Promise<JobExtraction> {
    const body = {
      model: this.config.extractionModel,
      temperature: 0,
      messages: [
        { role: "system", content: buildSystemPrompt(context.catalogLanguage) },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: EXTRACTION_JSON_SCHEMA,
      },
    };

    // Try once, then retry once on any parse/validation failure.
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const content = await chatCompletion(this.config, body);
        const json = JSON.parse(content) as unknown;
        const parsed = jobExtractionSchema.parse(json);
        return toDomain(parsed);
      } catch (error) {
        lastError = error;
      }
    }
    throw new ExtractionError(
      "The assistant could not produce a valid result. Please rephrase and try again.",
      lastError,
    );
  }
}

// The Zod output already matches the domain shape; this keeps the boundary explicit.
function toDomain(parsed: JobExtractionParsed): JobExtraction {
  return {
    detectedLanguage: parsed.detectedLanguage,
    items: parsed.items,
    assumptions: parsed.assumptions,
    missingInformation: parsed.missingInformation,
  };
}
