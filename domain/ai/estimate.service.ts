// COMMERCIAL DOMAIN. This AI service extracts work items and matches them
// against the commercial catalog for commercial offers. It is non-authoritative
// for money and is not part of the professional norm/resource estimate engine.
// See docs/architecture/commercial-vs-professional-estimates.md.
import type {
  OrganizationId,
  SupportedCurrency,
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
  hasElectricalIntentConflict,
  hasMountTypeConflict,
  hasProfileRoleConflict,
  hasStrongConflict,
  hasThicknessConflict,
  parseElectricalIntent,
  parseMountType,
  parseThicknessMm,
  pickSurface,
  tagProfileRoles,
  tagText,
} from "./concepts";
import type { WorkSurface } from "./concepts";
import { computeSurfaceArea } from "@/domain/quotes/geometry";
import type {
  ExtractedItem,
  ExtractionResult,
  MatchCandidate,
  MatchedItem,
} from "./extraction.types";
import type { MissingInformationField } from "./extraction.types";
import { SUPPORTED_UNITS } from "@/domain/shared/types";
import Decimal from "decimal.js";

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

// A partial-surface item does NOT cover the whole surface, so a stated
// full-surface area must not be propagated onto it (e.g. waterproofing raised
// a fixed band up the walls around the perimeter). Detected from explicit
// perimeter/raised-band wording in the item's own text.
function isPartialSurfaceScope(item: ExtractedItem): boolean {
  const text = `${item.description} ${item.rawText} ${item.specifications.join(" ")}`.toLowerCase();
  return /perimetr|ridic|brau|brâu|banda|bandă|plint|\bcm\b/u.test(text);
}

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
    // When set, catalog candidates whose currency differs are excluded so the
    // AI can never suggest an item that is incompatible with the quote being
    // edited. AI stays non-authoritative; this is a hard, deterministic gate.
    quoteCurrency?: SupportedCurrency,
  ): Promise<ExtractionResult> {
    const extraction = await this.extractionProvider.extract(text, {
      catalogLanguage,
    });

    // Deterministic take-off first, so an explicit surface area computed for
    // one operation can be reused by other operations on the SAME surface.
    for (const item of extraction.items) this.applyGeometry(item);
    this.propagateSurfaceAreas(extraction.items);

    const items: MatchedItem[] = [];
    for (const item of extraction.items) {
      items.push(await this.buildMatchedItem(organizationId, item, text, quoteCurrency));
    }

    return {
      detectedLanguage: extraction.detectedLanguage,
      items,
      assumptions: extraction.assumptions,
      missingInformation: extraction.missingInformation,
      missingInformationText: extraction.missingInformationText,
    };
  }

  // Applies user-entered missing-information values deterministically, without
  // re-running extraction. Only affected matching is re-evaluated.
  async recalculateWithMissingInformation(
    organizationId: OrganizationId,
    result: ExtractionResult,
    values: Record<string, string | number | boolean>,
    // Same currency gate as assist(): rematches must stay compatible with the
    // quote currency.
    quoteCurrency?: SupportedCurrency,
  ): Promise<ExtractionResult> {
    const items = result.items.map((m) => ({
      ...m.item,
      specifications: [...m.item.specifications],
      geometry: m.item.geometry
        ? {
            ...m.item.geometry,
            openings: m.item.geometry.openings.map((o) => ({ ...o })),
          }
        : null,
    }));

    const byId = new Map(items.map((item) => [item.id, item]));
    const needsRematch = new Set<string>();
    const unresolved: MissingInformationField[] = [];

    for (const field of result.missingInformation) {
      const raw = values[field.id];
      const resolved = this.applyMissingField(field, raw, byId, needsRematch);
      if (!resolved) unresolved.push(field);
    }

    for (const item of items) this.applyGeometry(item);
    this.propagateSurfaceAreas(items);

    const rematched = new Map<string, MatchedItem>();
    for (const itemId of needsRematch) {
      const item = byId.get(itemId);
      if (!item) continue;
      rematched.set(itemId, await this.buildMatchedItem(organizationId, item, item.rawText, quoteCurrency));
    }

    const nextItems = result.items.map((prev) => {
      const updated = byId.get(prev.item.id) ?? prev.item;
      return rematched.get(updated.id) ?? { ...prev, item: updated };
    });

    return {
      detectedLanguage: result.detectedLanguage,
      items: nextItems,
      assumptions: result.assumptions,
      missingInformation: unresolved,
      missingInformationText: result.missingInformationText,
    };
  }

  private applyMissingField(
    field: MissingInformationField,
    raw: string | number | boolean | undefined,
    byId: Map<string, ExtractedItem>,
    needsRematch: Set<string>,
  ): boolean {
    if (raw == null || raw === "") return !field.required;

    const related = field.relatedItemId ? byId.get(field.relatedItemId) ?? null : null;
    if (field.relatedItemId && !related) return false;

    const parsePositive = (value: string | number | boolean): string | null => {
      const source = typeof value === "string" ? value.trim() : String(value);
      if (source.length === 0) return null;
      try {
        const dec = new Decimal(source);
        if (!dec.isFinite() || dec.lte(0)) return null;
        return dec.toString();
      } catch {
        return null;
      }
    };

    const parseText = (value: string | number | boolean): string | null => {
      const text = String(value).trim();
      return text.length > 0 ? text : null;
    };

    const parseBoolean = (value: string | number | boolean): boolean | null => {
      if (typeof value === "boolean") return value;
      const normalized = String(value).trim().toLowerCase();
      if (["true", "yes", "da", "1"].includes(normalized)) return true;
      if (["false", "no", "nu", "0"].includes(normalized)) return false;
      return null;
    };

    switch (field.target.type) {
      case "item_quantity": {
        if (!related) return false;
        const quantity = parsePositive(raw);
        if (!quantity) return false;
        related.quantity = quantity;
        if (
          field.unit &&
          (SUPPORTED_UNITS as readonly string[]).includes(field.unit)
        ) {
          related.unit = field.unit as ExtractedItem["unit"];
        }
        return true;
      }
      case "geometry_dimension": {
        if (!related || !related.geometry || !field.target.key) return false;
        const value = parsePositive(raw);
        if (!value) return false;
        const numeric = Number(value);
        if (field.target.key === "length") related.geometry.length = numeric;
        if (field.target.key === "width") related.geometry.width = numeric;
        if (field.target.key === "height") related.geometry.height = numeric;
        return true;
      }
      case "geometry_perimeter": {
        if (!related) return false;
        const value = parsePositive(raw);
        if (!value) return false;
        related.quantity = value;
        related.unit = "m";
        return true;
      }
      case "specification": {
        if (!related || !field.target.key) return false;
        const value = parseText(raw);
        if (!value) return false;
        const prefix = `${field.target.key}:`;
        related.specifications = related.specifications.filter(
          (spec) => !spec.startsWith(prefix),
        );
        related.specifications.push(`${prefix}${value}`);
        needsRematch.add(related.id);
        return true;
      }
      case "decision": {
        if (!related || !field.target.key) return false;
        const value = field.inputType === "boolean" ? parseBoolean(raw) : parseText(raw);
        if (value == null) return false;
        const prefix = `decision:${field.target.key}=`;
        related.specifications = related.specifications.filter(
          (spec) => !spec.startsWith(prefix),
        );
        related.specifications.push(`${prefix}${String(value)}`);
        needsRematch.add(related.id);
        return true;
      }
      default:
        return false;
    }
  }

  private async buildMatchedItem(
    organizationId: OrganizationId,
    item: ExtractedItem,
    sourceText: string,
    quoteCurrency?: SupportedCurrency,
  ): Promise<MatchedItem> {
    const { candidates, lexicallySupportedIds, descriptions } =
      await this.matchItem(organizationId, item, quoteCurrency);
    let { status, suggestedCatalogItemId } = classify(candidates);

    if (this.rerankProvider && candidates.length > 0) {
      try {
        const chosen = await this.rerankProvider.rerank(
          sourceText,
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
          const idx = candidates.findIndex((c) => c.catalogItemId === chosen);
          if (idx > 0) candidates.unshift(candidates.splice(idx, 1)[0]!);
          suggestedCatalogItemId = chosen;
          if (status === "low" || status === "unmatched") status = "review";
        }
      } catch (error) {
        console.error("Rerank failed; keeping deterministic ranking:", error);
      }
    }

    if (
      status === "matched" &&
      suggestedCatalogItemId &&
      !lexicallySupportedIds.has(suggestedCatalogItemId)
    ) {
      status = "review";
    }

    if (status === "matched" && item.specifications.length > 0) {
      status = "review";
    }

    return { item, status, candidates, suggestedCatalogItemId };
  }

  // Retrieves real catalog rows for an item via HYBRID retrieval (lexical +
  // semantic), scores and ranks them. All retrieval is scoped to the
  // organization and item type by the repository. Returns the top candidates
  // plus the set of ids that had genuine lexical support (used to cap
  // semantic-only matches at review).
  private async matchItem(
    organizationId: OrganizationId,
    item: ExtractedItem,
    quoteCurrency?: SupportedCurrency,
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
    // The single canonical surface this item acts on (wall/floor/ceiling), if
    // clear. Used to block wrong-surface catalog rows (floor vs wall tile).
    const itemSurface = pickSurface(
      `${item.surface ?? ""} ${item.description} ${item.concept}`,
    );
    // Drywall profile role of the requirement (partition vs ceiling), when the
    // text is clearly about a profile. Blocks CD/UD ceiling profiles from
    // matching a partition-wall profile requirement, and vice-versa.
    const itemProfileRoles = tagProfileRoles(
      `${item.concept} ${item.description} ${item.rawText} ${item.searchTerms.join(" ")}`,
    );
    // Required material thickness (mm), when explicitly specified. Blocks a
    // technically wrong thickness (e.g. a 50 mm board for a required 75 mm one).
    const itemThicknessMm = parseThicknessMm(
      `${item.specifications.join(" ")} ${item.description} ${item.rawText}`,
    );
    // Required sanitary mounting type (wall-hung vs floor), when specified.
    // Blocks a WC suspendat/încastrat from matching a floor-mounted WC row.
    const itemMountType = parseMountType(
      `${item.specifications.join(" ")} ${item.description} ${item.rawText}`,
    );
    // Electrical intent (new point / relocate / remove / mechanism / breaker /
    // cable): a strong compatibility gate so a new point never matches a
    // relocation, a wall switch never matches a breaker, etc.
    const itemElectricalIntent = parseElectricalIntent(
      `${item.concept} ${item.specifications.join(" ")} ${item.description} ${item.rawText}`,
    );
    const scored: MatchCandidate[] = [];
    const lexicallySupportedIds = new Set<string>();
    for (const row of byId.values()) {
      // Currency gate (M7.1): never suggest a catalog row priced in a currency
      // that differs from the quote being edited. Runs before scoring so
      // semantic similarity can never override currency compatibility.
      if (quoteCurrency && row.currency !== quoteCurrency) continue;

      const rowText = `${row.name} ${row.description ?? ""} ${row.code ?? ""}`;
      const rowTags = tagText(rowText);

      // Deterministic guards run AFTER merge and are never overridden by
      // similarity: strong action/object/surface conflict, then the unit gate.
      if (hasStrongConflict(item.action, item.object, rowTags, itemSurface))
        continue;
      if (
        hasProfileRoleConflict(itemProfileRoles, tagProfileRoles(rowText))
      )
        continue;
      if (hasThicknessConflict(itemThicknessMm, rowText)) continue;
      if (hasMountTypeConflict(itemMountType, rowText)) continue;
      if (hasElectricalIntentConflict(itemElectricalIntent, rowText)) continue;
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
      if (itemSurface && rowTags.surfaces.has(itemSurface)) {
        bonus += 0.1;
      }
      // Reward a row whose electrical intent matches the request, so the right
      // operation ranks first among the (already gate-filtered) candidates.
      if (itemElectricalIntent &&
          parseElectricalIntent(rowText) === itemElectricalIntent) {
        bonus += 0.3;
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

  // Contextual quantity propagation: an area the user stated for one full-surface
  // operation (e.g. floor = 5 m²) is deterministically reused by other
  // full-surface operations on the SAME surface that have no quantity yet
  // (floor demolition, floor waterproofing, new floor tiling). This is factual
  // reuse of a stated measurement, not a fabricated assumption. Partial-scope
  // items (e.g. perimeter waterproofing raised 20 cm on walls) are excluded, and
  // an existing quantity is never overwritten.
  private propagateSurfaceAreas(items: ExtractedItem[]): void {
    const surfaceOf = (item: ExtractedItem): WorkSurface | null =>
      pickSurface(`${item.surface ?? ""} ${item.description} ${item.concept}`);

    // A reference net area per surface, taken from a full-surface m² item that
    // already carries an explicit quantity.
    const referenceArea = new Map<WorkSurface, string>();
    for (const item of items) {
      if (item.unit !== "m2" || !item.quantity) continue;
      if (isPartialSurfaceScope(item)) continue;
      const surface = surfaceOf(item);
      if (!surface || surface === "other") continue;
      if (!referenceArea.has(surface)) referenceArea.set(surface, item.quantity);
    }

    for (const item of items) {
      if (item.quantity || item.unit !== "m2") continue;
      if (isPartialSurfaceScope(item)) continue;
      const surface = surfaceOf(item);
      if (!surface || surface === "other") continue;
      const ref = referenceArea.get(surface);
      if (ref) item.quantity = ref;
    }
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

  // Deterministic take-off: when the item carries geometry with enough
  // dimensions, compute the exact NET area (m²) and set it as the quantity,
  // overriding any AI-guessed number. No-op when geometry is absent/incomplete
  // so a missing dimension never silently produces a wrong quantity.
  private applyGeometry(item: ExtractedItem): void {
    if (!item.geometry) return;
    const area = computeSurfaceArea(item.geometry.shape, {
      length: item.geometry.length,
      width: item.geometry.width,
      height: item.geometry.height,
      openings: item.geometry.openings.map((o) => ({
        width: o.width,
        height: o.height,
        count: o.count ?? 1,
      })),
    });
    if (area === null) return;
    item.quantity = area;
    item.unit = "m2";
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
