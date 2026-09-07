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
          specifications: { type: "ARRAY", items: { type: "STRING" } },
          geometry: {
            type: "OBJECT",
            nullable: true,
            properties: {
              shape: {
                type: "STRING",
                enum: ["wall_rectangle", "room_walls", "floor", "ceiling"],
              },
              length: { type: "NUMBER", nullable: true },
              width: { type: "NUMBER", nullable: true },
              height: { type: "NUMBER", nullable: true },
              openings: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    width: { type: "NUMBER" },
                    height: { type: "NUMBER" },
                    count: { type: "NUMBER", nullable: true },
                  },
                  required: ["width", "height", "count"],
                },
              },
            },
            required: ["shape", "length", "width", "height", "openings"],
          },
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
          "specifications",
          "geometry",
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
    `- object: exactly one of [${objects}] or null. The thing acted upon, NOT the surface. Examples: tapet/oboi/обои → wallpaper; faianță/gresie/плитка → tiles; gips-carton → drywall; șapă/стяжка → screed; glet/șpacluire → putty; amorsă/amorsare/grund/grunduire/грунтовка → primer (NOT putty); vopsea → paint; laminat/parchet → flooring; priză/розетка → socket; plașă/fibră de sticlă → mesh; hidroizolație/hidroizolare/гидроизоляция → waterproofing (NOT tiles, NOT mesh); WC/vas WC/lavoar/chiuvetă/duș/cabină de duș/cadă → sanitaryware; țeavă/țevi/conductă/canalizare/scurgere → pipe. Use null (not \"other\") only when there is genuinely no object.`,
    "- surface: one of \"wall\", \"floor\", \"ceiling\", or null when it does not apply. Priming/puttying/painting walls → \"wall\"; the same on tavan/plafon → \"ceiling\"; laminat/gresie pe jos/podea → \"floor\".",
    "- normalizedConcept: a short language-neutral concept phrase, e.g. \"remove wallpaper from wall\".",
    "",
    "DO NOT MERGE — GENERAL SEPARATION INVARIANT:",
    "Keep two requirements as SEPARATE items whenever ANY of these differ between them:",
    "  1. surface (wall vs floor vs ceiling),",
    "  2. spatial region (e.g. whole floor vs a perimeter band on the walls),",
    "  3. quantity source (which measurement the amount comes from),",
    "  4. geometry formula (e.g. floor area length×width vs a raised 20 cm perimeter band),",
    "  5. specification (any hard qualifier, mount type, dimension, thickness, material grade),",
    "  6. object (the thing acted upon),",
    "  7. unit,",
    "  8. required missing information (what still needs measuring/clarifying).",
    "NEVER merge two requirements merely because they share the same catalog item, the same action, or appear in the same sentence.",
    "Only MERGE items when they are the SAME operation over the SAME surface/object/specification AND their quantities can be safely summed (e.g. laminate laid across several rooms → one install-laminate item).",
    "Worked examples of the invariant (they must stay SEPARATE):",
    "  - 'hidroizolație pe podea și ridicată 20 cm pe pereți' → floor waterproofing AND wall perimeter waterproofing (different surface + geometry formula).",
    "  - 'gresie 5 m2 pe podea și faianță 22 m2 pe pereți' → two items (different surface).",
    "  - '18 prize și 7 întrerupătoare' → two items with their own counts (different object).",
    "  - 'vopsim pereții și tavanul' → two items (different surface + quantity source).",
    "  - Cold water (apă rece), hot water (apă caldă) and sewer (canalizare) → three items even under one action 'schimbăm complet' (different object/system).",
    "  - A wall-hung/concealed WC (suspendat/încastrat) vs a floor-mounted WC (pe pardoseală) differ by specification: put the mount word in specifications AND description.",
    "",
    "EXPLICIT SCOPE DECOMPOSITION: when the user describes a compound assembly (e.g. a drywall partition), break it into ATOMIC items — but ONLY for things the user explicitly stated:",
    "- Emit the LABOR item (e.g. construct drywall partition) with the deterministic geometry/quantity.",
    "- Emit a SEPARATE item with kind 'material' for each explicitly named material or special component (e.g. vată minerală 75 mm → one material item; profil 75 mm → one material item). Set its quantity to null unless the user gave an explicit amount or an explicit deterministic rule applies. Never invent studs, screws, boards, tapes, waste factors or package counts.",
    "- Put non-priceable qualifying attributes (e.g. gips-carton dublu, pe ambele părți) in the item's `specifications` array (short phrases), AND keep them in the description. These are NOT separate priced lines.",
    "- A generic labor catalog item must NOT be assumed to include double boarding, insulation or special profiles: keep those explicit as above so the user prices them.",
    "- Doors/windows are geometry openings for area take-off. Do NOT create a line to INSTALL a door unless the user clearly asked to install/supply the door itself; if intent is unclear, add a note to missingInformation instead of assuming.",
    "- specifications: array of short explicit qualifier phrases for this item, or an empty array. Never invent qualifiers.",
    "",
    "INSTALLATION DEPTH/SCOPE: distinguish how much work a request covers, because it changes the catalog operation and price.",
    "- A NEW electrical POINT that explicitly includes wiring/box/routing/'punct nou' (cablu, doză, traseu) is the COMPLETE point labor (concept like 'new electrical point'), NOT just fitting the mechanism. Keep the qualifier (e.g. 'cu cablu și doză') in specifications and description, and use searchTerms like 'punct electric', 'executare punct'.",
    "- Installing only the final mechanism into an already-prepared box (e.g. 'montăm priza în doza pregătită') is the mechanism-only labor (searchTerms 'montare priză/întrerupător'). Do not upgrade it to a full point.",
    "- Sockets (prize) and switches (întrerupătoare) stay separate items with their own counts even when installed as new points.",
    "",
    "ELECTRICAL COMPOUND SPLIT: when one phrase names multiple independently priced electrical operations, emit them as SEPARATE atomic items. Example: 'tragem un circuit separat până în tablou și punem un automat de 20A' → (1) labor cable routing/'pozare cablu/traseu' with quantity null when the length is unknown, plus a missingInformation note that the cable length is not measured; (2) labor 'montare întrerupător automat', quantity 1, specification '20A'. Never merge them just because they belong to the same circuit.",
    "",
    "GEOMETRY (deterministic take-off): when the user gives room/wall dimensions, DO NOT compute areas yourself. Instead fill the `geometry` object with raw measurements in metres and leave `quantity` null — the app computes the exact m². Set geometry.shape to: \"room_walls\" for all walls of a room (needs length,width,height); \"ceiling\" or \"floor\" for a room slab (needs length,width); \"wall_rectangle\" for one wall panel (needs width,height). Put windows/doors in geometry.openings (width,height,count). When there are no usable dimensions, set geometry to null.",
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
