import type { SupportedLanguage } from "@/domain/shared/types";
import type { JobExtraction } from "./extraction.types";

/**
 * Thin provider ports so provider-specific AI code stays isolated. Swapping
 * OpenAI for another vendor means writing a new adapter only.
 */

// Context the extractor needs to bias search terms toward the org's catalog.
export interface ExtractionContext {
  // The language the company's catalog is written in (its default language).
  catalogLanguage: SupportedLanguage;
}

// Turns free text into a validated JobExtraction. Implementations must use
// strict structured outputs and validate before returning.
export interface ExtractionProvider {
  extract(text: string, context: ExtractionContext): Promise<JobExtraction>;
}

// Raised when the provider cannot return valid structured output, even after a
// single retry. Callers surface this as a controlled, user-visible error.
export class ExtractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ExtractionError";
  }
}
