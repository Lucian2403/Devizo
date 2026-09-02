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
import {
  generateJson,
  readGeminiConfig,
  type GeminiConfig,
  type GeminiResponseSchema,
} from "./client";

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

// The structured response schema, expressed in Gemini's OpenAPI subset.
// Nullable fields use `nullable: true` (Gemini does not accept type arrays).
// Strict shape validation is still enforced afterwards with Zod.
const EXTRACTION_RESPONSE_SCHEMA: GeminiResponseSchema = {
  type: "OBJECT",
  properties: {
    detectedLanguage: {
      type: "STRING",
      enum: [...SUPPORTED_LANGUAGES, "unknown"],
    },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          concept: { type: "STRING" },
          kind: { type: "STRING", enum: [...CATALOG_ITEM_TYPES] },
          action: { type: "STRING", enum: [...WORK_ACTIONS] },
          object: { type: "STRING", nullable: true, enum: [...WORK_OBJECTS] },
          surface: { type: "STRING", nullable: true },
          normalizedConcept: { type: "STRING" },
          rawText: { type: "STRING" },
          description: { type: "STRING" },
          quantity: { type: "STRING", nullable: true },
          unit: { type: "STRING", nullable: true, enum: [...SUPPORTED_UNITS] },
          confidence: { type: "NUMBER" },
          searchTerms: { type: "ARRAY", items: { type: "STRING" } },
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
    assumptions: { type: "ARRAY", items: { type: "STRING" } },
    missingInformation: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["detectedLanguage", "items", "assumptions", "missingInformation"],
};

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
    "- kind: 'labor' when the user describes an OPERATION/work (vopsim, montăm, dăm jos, tencuim); 'material' ONLY when the user explicitly names a product/material with the intent to supply it (e.g. '20 m2 laminat Krono', 'vată minerală', 'vopsea lavabilă'). If unsure, prefer 'labor'. Do NOT invent materials that were not explicitly mentioned.",
    `- action: exactly one of [${actions}]. remove = demolish/strip/take down; install = mount/lay/build; prepare = putty/plaster/prime (e.g. glet, șpăcluire, șpacliovcă, шпаклевка); finish = paint/whitewash (vopsire, zugrăvire); repair = fix/patch; other only if none fits.`,
    `- object: exactly one of [${objects}] or null. The thing acted upon, NOT the surface. Examples: tapet/oboi/обои → wallpaper; faianță/gresie/плитка → tiles; gips-carton → drywall; șapă/стяжка → screed; glet/șpacluire → putty; vopsea → paint; laminat/parchet → flooring; priză/розетка → socket; plașă/fibră de sticlă → mesh; WC/vas WC/lavoar/chiuvetă/duș/cabină de duș/cadă → sanitaryware; țeavă/țevi/conductă/canalizare/scurgere → pipe. Use null (not \"other\") only when there is genuinely no object.`,
    "- surface: short context like \"wall\", \"ceiling\", \"floor\", \"bathroom\", or null.",
    "- normalizedConcept: a short language-neutral concept phrase, e.g. \"remove wallpaper from wall\".",
    "",
    "OTHER FIELDS:",
    `- quantity: a decimal number as a STRING (e.g. \"18\", \"20.5\"), or null if the user did not state one. Never fabricate quantities. If the amount is genuinely unknown (e.g. \"montăm țevi noi\", \"canalizare nouă\"), use null — do NOT default to 1. For a single explicit object (e.g. \"WC suspendat\") quantity 1 is acceptable.`,
    `- unit: one of exactly [${units}], or null if unclear. Never output any other unit string.`,
    "- confidence: a number between 0 and 1 reflecting how sure you are about the item.",
    `- searchTerms: 1-6 short catalog lookup terms translated into ${catalogName} (the company's catalog language). Include the real catalog word for the object (e.g. use \"glet\" for putty, \"tapet\" for wallpaper) plus common synonyms.`,
    "- description: a short human description of the item in the detected input language.",
    "- assumptions: anything you inferred. missingInformation: what the contractor should clarify.",
  ].join("\n");
}

/**
 * Gemini-backed extraction provider. Uses structured JSON output and
 * re-validates with Zod. On invalid output it retries once, then raises a
 * controlled ExtractionError.
 */
export class GeminiExtractionProvider implements ExtractionProvider {
  private readonly config: GeminiConfig;

  constructor(config?: GeminiConfig) {
    this.config = config ?? readGeminiConfig();
  }

  async extract(
    text: string,
    context: ExtractionContext,
  ): Promise<JobExtraction> {
    const systemInstruction = buildSystemPrompt(context.catalogLanguage);

    // Try once, then retry once on any parse/validation failure.
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const content = await generateJson(
          this.config,
          systemInstruction,
          text,
          EXTRACTION_RESPONSE_SCHEMA,
        );
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
