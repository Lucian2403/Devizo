// A single candidate shown to the reranker. Deliberately excludes prices — the
// model must choose on meaning alone, never on cost.
export interface RerankCandidate {
  catalogItemId: string;
  name: string;
  unit: string;
  description: string | null;
}

/**
 * Optional last step of matching: an LLM picks the best real catalog item from
 * a SHORT list of already-retrieved candidates, or answers NO_MATCH. It can
 * only choose an id from the given list — it can never invent one. Any invalid
 * answer must be treated as NO_MATCH by the caller.
 */
export interface RerankProvider {
  rerank(
    userText: string,
    itemText: string,
    candidates: RerankCandidate[],
  ): Promise<string | null>;
}
