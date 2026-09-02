import type {
  ExtractedItem,
  MatchCandidate,
  MatchStatus,
} from "./extraction.types";

/**
 * Deterministic catalog matching helpers. No embeddings or vector DB. The
 * multilingual bridge lives upstream: the extractor produces search terms in
 * the catalog's language, the service retrieves REAL catalog rows with those
 * terms, and these helpers only score/classify already-retrieved candidates.
 * The catalog is always authoritative — we never invent items or prices here.
 */

// Match classification thresholds over the COMBINED score (token overlap plus
// semantic action/object/surface bonuses). Compatibility filtering happens
// upstream, so a wrong-object candidate never reaches here. Anything below the
// low bar is treated as NO_MATCH — a wrong match is worse than none.
const HIGH_SCORE = 0.6;
const MEDIUM_SCORE = 0.42;
const LOW_SCORE = 0.28;
const AMBIGUITY_GAP = 0.12;

// Lowercases and strips diacritics so "faianță" and "faianta" compare equal.
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Splits normalized text into meaningful tokens (drops very short noise).
export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

// Scores how well a candidate's text matches the query tokens, 0..1.
// Combines token overlap (Jaccard) with a substring bonus for partial hits.
export function scoreTokens(
  queryTokens: string[],
  candidateText: string,
): number {
  if (queryTokens.length === 0) return 0;
  const candTokens = tokenize(candidateText);
  if (candTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  const candSet = new Set(candTokens);

  let intersection = 0;
  for (const t of querySet) if (candSet.has(t)) intersection += 1;

  const union = new Set([...querySet, ...candSet]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  // Partial bonus: a query token appears inside a candidate token, or the two
  // share a long common stem. The stem case bridges inflected variants such as
  // "montaj" (extractor) vs "montare" (catalog) that neither contains.
  let partial = 0;
  for (const q of querySet) {
    for (const c of candSet) {
      if (q !== c && (c.includes(q) || q.includes(c) || sharesStem(q, c))) {
        partial += 1;
        break;
      }
    }
  }
  const partialRatio = partial / querySet.size;

  return Math.min(1, jaccard * 0.75 + partialRatio * 0.25);
}

// Two tokens share a stem when they agree on a prefix of at least 4 characters
// (e.g. "montaj"/"montare", "canalizare"/"canalizarea").
function sharesStem(a: string, b: string): boolean {
  const limit = Math.min(a.length, b.length);
  if (limit < 4) return false;
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  return i >= 4;
}

// Builds the set of query tokens for an extracted item, blending the concept,
// normalized concept, surface, description and the catalog-language search terms.
export function buildQueryTokens(item: ExtractedItem): string[] {
  const parts = [
    item.concept,
    item.normalizedConcept,
    item.surface ?? "",
    item.description,
    ...item.searchTerms,
  ];
  const tokens = new Set<string>();
  for (const part of parts) for (const t of tokenize(part)) tokens.add(t);
  return [...tokens];
}

// Classifies a list of scored candidates (already sorted, highest first) into a
// confidence tier. Candidates here are already compatibility-filtered.
export function classify(candidates: MatchCandidate[]): {
  status: MatchStatus;
  suggestedCatalogItemId: string | null;
} {
  if (candidates.length === 0) {
    return { status: "unmatched", suggestedCatalogItemId: null };
  }
  const top = candidates[0]!;
  const second = candidates[1];
  const clearlyBest = !second || top.score - second.score >= AMBIGUITY_GAP;

  if (top.score >= HIGH_SCORE && clearlyBest) {
    return { status: "matched", suggestedCatalogItemId: top.catalogItemId };
  }
  if (top.score >= MEDIUM_SCORE) {
    // Medium: surface a suggestion, but the UI forces a review.
    return { status: "review", suggestedCatalogItemId: top.catalogItemId };
  }
  if (top.score >= LOW_SCORE) {
    // Low: show candidates but preselect nothing.
    return { status: "low", suggestedCatalogItemId: null };
  }
  return { status: "unmatched", suggestedCatalogItemId: null };
}
