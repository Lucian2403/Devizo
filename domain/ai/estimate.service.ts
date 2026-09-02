import type {
  OrganizationId,
  SupportedLanguage,
} from "@/domain/shared/types";
import type { CatalogItem, CatalogItemRepository } from "@/domain/catalog/item.repository";
import type { ExtractionProvider } from "./providers";
import type { EmbeddingProvider } from "./embedding.provider";
import type { RerankProvider } from "./rerank.provider";
import {
  buildQueryTokens,
  classify,
  scoreTokens,
  tokenize,
} from "./matching";
import {
  expandJargon,
  hasStrongConflict,
  tagText,
} from "./concepts";
import type {
  ExtractedItem,
  ExtractionResult,
  MatchCandidate,
  MatchedItem,
} from "./extraction.types";

// How many catalog rows to pull per search term, and how many candidates to
// surface per extracted item after scoring.
const ROWS_PER_TERM = 8;
const MAX_TERMS = 10;
const TOP_CANDIDATES = 3;
// How many nearest rows to pull from the semantic vector search.
const SEMANTIC_ROWS = 10;
// Hybrid score weights: lexical token overlap vs semantic cosine similarity.
// Semantic bonuses (object/action/surface) are added on top of this blend.
const WEIGHT_LEXICAL = 0.6;
const WEIGHT_SEMANTIC = 0.4;
// A top candidate with lexical support below this is treated as semantic-only
// and may not be auto-selected (capped at review), per requirement 6.
const LEXICAL_MIN_FOR_MATCH = 0.15;

/**
 * Orchestrates AI-assisted extraction:
 *   text → extraction (provider) → multilingual catalog retrieval → scoring.
 * Money is never involved here; candidates carry catalog prices verbatim and
 * nothing is persisted. The catalog is authoritative.
 */
export class EstimateAssistantService {
  constructor(
    private readonly extractionProvider: ExtractionProvider,
    private readonly catalogRepository: CatalogItemRepository,
    // Optional: when present, retrieval also runs semantic vector search and
    // blends it with lexical scoring. When absent (or if it fails), matching
    // degrades gracefully to lexical-only — the flow never hard-depends on it.
    private readonly embeddingProvider?: EmbeddingProvider,
    // Optional: when present, an LLM reranks the short candidate list and may
    // pick a better match or answer NO_MATCH. Best-effort — any failure keeps
    // the deterministic ranking.
    private readonly rerankProvider?: RerankProvider,
  ) {}

  async assist(
    organizationId: OrganizationId,
    catalogLanguage: SupportedLanguage,
    text: string,
  ): Promise<ExtractionResult> {
    const extraction = await this.extractionProvider.extract(text, {
      catalogLanguage,
    });

    const items: MatchedItem[] = [];
    for (const item of extraction.items) {
      const { candidates, lexicallySupportedIds, descriptions } =
        await this.matchItem(organizationId, item);
      let { status, suggestedCatalogItemId } = classify(candidates);

      // Optional LLM rerank: may reorder to a better candidate or force
      // NO_MATCH. It can only choose from the retrieved list; invalid answers
      // come back as null. Deterministic guards already excluded bad rows.
      if (this.rerankProvider && candidates.length > 0) {
        try {
          const chosen = await this.rerankProvider.rerank(
            text,
            item.rawText,
            candidates.map((c) => ({
              catalogItemId: c.catalogItemId,
              name: c.name,
              unit: c.unit,
              description: descriptions.get(c.catalogItemId) ?? null,
            })),
          );
          if (chosen === null) {
            status = "unmatched";
            suggestedCatalogItemId = null;
          } else {
            const idx = candidates.findIndex(
              (c) => c.catalogItemId === chosen,
            );
            if (idx > 0) candidates.unshift(candidates.splice(idx, 1)[0]!);
            suggestedCatalogItemId = chosen;
            if (status === "low" || status === "unmatched") status = "review";
          }
        } catch (error) {
          console.error(
            "Rerank failed; keeping deterministic ranking:",
            error,
          );
        }
      }

      // Semantic-only safety: a candidate the lexical layer did not support may
      // never be auto-selected. Downgrade HIGH to review so the user confirms.
      if (
        status === "matched" &&
        suggestedCatalogItemId &&
        !lexicallySupportedIds.has(suggestedCatalogItemId)
      ) {
        status = "review";
      }

      items.push({ item, status, candidates, suggestedCatalogItemId });
    }

    return {
      detectedLanguage: extraction.detectedLanguage,
      items,
      assumptions: extraction.assumptions,
      missingInformation: extraction.missingInformation,
    };
  }

  // Retrieves real catalog rows for an item via HYBRID retrieval (lexical +
  // semantic), scores and ranks them. All retrieval is scoped to the
  // organization and item type by the repository. Returns the top candidates
  // plus the set of ids that had genuine lexical support (used to cap
  // semantic-only matches at review).
  private async matchItem(
    organizationId: OrganizationId,
    item: ExtractedItem,
  ): Promise<{
    candidates: MatchCandidate[];
    lexicallySupportedIds: Set<string>;
    descriptions: Map<string, string | null>;
  }> {
    const terms = this.buildSearchTerms(item);

    // (a+b) Lexical retrieval. HARD TYPE FILTER: labor extractions search only
    // labor items, materials only materials — applied in the repository.
    const byId = new Map<string, CatalogItem>();
    for (const term of terms) {
      const rows = await this.catalogRepository.searchActive(
        organizationId,
        term,
        ROWS_PER_TERM,
        item.kind,
      );
      for (const row of rows) byId.set(row.id, row);
    }

    // (c) Semantic retrieval (best-effort). The same org/type/active hard
    // filters are enforced inside the vector query; similarity never overrides
    // them. Any failure degrades to lexical-only.
    const semanticSimilarity = new Map<string, number>();
    if (this.embeddingProvider) {
      try {
        const [queryVector] = await this.embeddingProvider.embed([
          this.buildQueryText(item),
        ]);
        if (queryVector) {
          const semantic = await this.catalogRepository.semanticSearch(
            organizationId,
            queryVector,
            item.kind,
            SEMANTIC_ROWS,
          );
          for (const { item: row, similarity } of semantic) {
            byId.set(row.id, row);
            semanticSimilarity.set(row.id, similarity);
          }
        }
      } catch (error) {
        console.error(
          "Semantic catalog search failed; using lexical only:",
          error,
        );
      }
    }

    const queryTokens = buildQueryTokens(item);
    const scored: MatchCandidate[] = [];
    const lexicallySupportedIds = new Set<string>();
    for (const row of byId.values()) {
      const rowText = `${row.name} ${row.description ?? ""} ${row.code ?? ""}`;
      const rowTags = tagText(rowText);

      // Deterministic guards run AFTER merge and are never overridden by
      // similarity: strong action/object conflict, then the hard unit gate.
      if (hasStrongConflict(item.action, item.object, rowTags)) continue;
      if (item.unit && row.unit !== item.unit) continue;

      const nameScore = scoreTokens(queryTokens, row.name);
      const descScore = row.description
        ? scoreTokens(queryTokens, row.description)
        : 0;
      const codeScore = row.code ? scoreTokens(queryTokens, row.code) : 0;
      const lexScore = Math.max(nameScore, descScore, codeScore);
      const semScore = semanticSimilarity.get(row.id) ?? 0;

      if (lexScore >= LEXICAL_MIN_FOR_MATCH) lexicallySupportedIds.add(row.id);

      // Semantic bonuses: reward matching object/action/surface.
      let bonus = 0;
      if (item.object && item.object !== "other" && rowTags.objects.has(item.object)) {
        bonus += 0.3;
      }
      if (item.action !== "other" && rowTags.actions.has(item.action)) {
        bonus += 0.15;
      }
      if (item.surface) {
        const surfaceHit = tokenize(item.surface).some((t) =>
          scoreTokens([t], rowText) > 0,
        );
        if (surfaceHit) bonus += 0.1;
      }

      const base = WEIGHT_LEXICAL * lexScore + WEIGHT_SEMANTIC * semScore;
      const score = Math.min(1, base + bonus);
      if (score <= 0) continue;
      scored.push({
        catalogItemId: row.id,
        name: row.name,
        code: row.code,
        unit: row.unit,
        sellingPrice: row.sellingPrice,
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, TOP_CANDIDATES);
    const descriptions = new Map<string, string | null>();
    for (const c of candidates) {
      descriptions.set(c.catalogItemId, byId.get(c.catalogItemId)?.description ?? null);
    }
    return { candidates, lexicallySupportedIds, descriptions };
  }

  // Builds the text embedded for semantic search on the query side. Mirrors the
  // catalog embed-text's spirit (concept + description + terms) without a
  // category, which the extracted item does not have.
  private buildQueryText(item: ExtractedItem): string {
    return [
      item.concept,
      item.normalizedConcept,
      item.description,
      item.surface ?? "",
      ...item.searchTerms,
    ]
      .filter((part) => part && part.trim().length > 0)
      .join("\n");
  }

  // Uses the model's catalog-language search terms plus concept/description
  // tokens, widened with jargon/cross-language expansions so retrieval reaches
  // catalog rows written with different vocabulary (e.g. șpacliovcă → glet).
  private buildSearchTerms(item: ExtractedItem): string[] {
    const terms = item.searchTerms
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);

    terms.push(...tokenize(item.concept), ...tokenize(item.description));

    // Jargon expansion over every term collected so far.
    const expanded: string[] = [];
    for (const term of terms) expanded.push(...expandJargon(term));
    terms.push(...expanded);

    return [...new Set(terms)].slice(0, MAX_TERMS);
  }
}
