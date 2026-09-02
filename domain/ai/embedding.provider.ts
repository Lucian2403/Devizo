/**
 * Provider-agnostic embedding port for semantic catalog matching (M5.1).
 *
 * Domain and application code depend ONLY on this interface — never on a
 * Gemini/OpenAI SDK. The concrete provider is chosen in the composition root
 * (server/container.ts), so swapping providers is a one-line change.
 */
export interface EmbeddingProvider {
  /** Model identifier, stored alongside each embedding for safe re-embedding. */
  readonly model: string;
  /** Output dimensionality; must match the fixed catalog_items.embedding size. */
  readonly dimensions: number;
  /**
   * Embeds a batch of texts, preserving order. Implementations should send the
   * batch in as few requests as practical. Returns one vector per input text.
   */
  embed(texts: string[]): Promise<number[][]>;
}

export class EmbeddingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmbeddingError";
  }
}
