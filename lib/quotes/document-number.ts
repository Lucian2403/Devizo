import type { QuoteVersion } from "@/domain/quotes/quote.repository";

// The official number is assigned once at send/finalize time and stored on the
// immutable version snapshot. Drafts intentionally have no official number.
export function buildQuoteDocumentNumber(version: QuoteVersion): string {
  return version.documentNumber ?? "—";
}
