import {
  type RerankCandidate,
  type RerankProvider,
} from "@/domain/ai/rerank.provider";
import {
  generateJson,
  readGeminiConfig,
  type GeminiConfig,
  type GeminiResponseSchema,
} from "./client";

// The reranker returns exactly one field: the chosen catalog id, or null for
// NO_MATCH. Strict validation against the candidate set happens in the adapter.
const RERANK_RESPONSE_SCHEMA: GeminiResponseSchema = {
  type: "OBJECT",
  properties: {
    catalogItemId: { type: "STRING", nullable: true },
  },
  required: ["catalogItemId"],
};

const SYSTEM_PROMPT = [
  "You are matching one renovation/construction work item to a company's catalog.",
  "You are given the contractor's original text, the specific item, and a SHORT list of candidate catalog rows.",
  "Choose the single candidate that best means the SAME work as the item.",
  "",
  "STRICT RULES:",
  "- You may only return the catalogItemId of one candidate from the given list, or null.",
  "- Never invent an id. If no candidate is a genuine match, return null (NO_MATCH).",
  "- Ignore prices entirely (there are none shown). Match on meaning, action and object.",
  "- A demolition/removal item must not be matched to an installation item, and vice versa.",
  "",
  "Return JSON: { \"catalogItemId\": \"<id from the list>\" } or { \"catalogItemId\": null }.",
].join("\n");

/**
 * Gemini-backed reranker. Best-effort: on any failure the caller keeps the
 * deterministic ranking, so this never blocks matching.
 */
export class GeminiRerankProvider implements RerankProvider {
  private readonly config: GeminiConfig;

  constructor(config?: GeminiConfig) {
    this.config = config ?? readGeminiConfig();
  }

  async rerank(
    userText: string,
    itemText: string,
    candidates: RerankCandidate[],
  ): Promise<string | null> {
    if (candidates.length === 0) return null;

    const allowedIds = new Set(candidates.map((c) => c.catalogItemId));
    const prompt = [
      `Original text:\n${userText}`,
      "",
      `Item to match:\n${itemText}`,
      "",
      "Candidates:",
      ...candidates.map(
        (c) =>
          `- id=${c.catalogItemId} | ${c.name} [${c.unit}]` +
          (c.description ? ` — ${c.description}` : ""),
      ),
    ].join("\n");

    const content = await generateJson(
      this.config,
      SYSTEM_PROMPT,
      prompt,
      RERANK_RESPONSE_SCHEMA,
    );
    const parsed = JSON.parse(content) as { catalogItemId?: unknown };
    const chosen = parsed.catalogItemId;

    // Only accept an id that is actually in the candidate list.
    if (typeof chosen === "string" && allowedIds.has(chosen)) return chosen;
    return null;
  }
}
