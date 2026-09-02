import type {
  OrganizationId,
  SupportedLanguage,
} from "@/domain/shared/types";
import type { CatalogItem, CatalogItemRepository } from "@/domain/catalog/item.repository";
import type { ExtractionProvider } from "./providers";
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
      const candidates = await this.matchItem(organizationId, item);
      const { status, suggestedCatalogItemId } = classify(candidates);
      items.push({ item, status, candidates, suggestedCatalogItemId });
    }

    return {
      detectedLanguage: extraction.detectedLanguage,
      items,
      assumptions: extraction.assumptions,
      missingInformation: extraction.missingInformation,
    };
  }

  // Retrieves real catalog rows for an item's search terms, scores and ranks
  // them. All retrieval is scoped to the organization by the repository.
  private async matchItem(
    organizationId: OrganizationId,
    item: ExtractedItem,
  ): Promise<MatchCandidate[]> {
    const terms = this.buildSearchTerms(item);

    // Retrieve candidate rows, de-duplicated by id. HARD TYPE FILTER: labor
    // extractions search only labor items, materials only materials — the
    // repository applies this deterministically before any fuzzy scoring.
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

    const queryTokens = buildQueryTokens(item);
    const scored: MatchCandidate[] = [];
    for (const row of byId.values()) {
      const rowText = `${row.name} ${row.description ?? ""} ${row.code ?? ""}`;
      const rowTags = tagText(rowText);

      // Compatibility filtering: strong action/object conflicts exclude the
      // candidate entirely. Prefer NO_MATCH over an unrelated catalog item.
      if (hasStrongConflict(item.action, item.object, rowTags)) continue;

      // HARD UNIT GATE: when the extraction has a definite unit, a candidate
      // with a different unit is excluded (e.g. "vopsire pereți" m2 must never
      // match a "Vopsea 14 kg" priced per pcs).
      if (item.unit && row.unit !== item.unit) continue;

      const nameScore = scoreTokens(queryTokens, row.name);
      const descScore = row.description
        ? scoreTokens(queryTokens, row.description)
        : 0;
      const codeScore = row.code ? scoreTokens(queryTokens, row.code) : 0;
      const tokenScore = Math.max(nameScore, descScore, codeScore);

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

      const score = Math.min(1, tokenScore + bonus);
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
    return scored.slice(0, TOP_CANDIDATES);
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
