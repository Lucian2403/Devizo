import type { QuoteVersion } from "@/domain/quotes/quote.repository";

// Lightweight customer-facing number derived from immutable version data.
// No separate sequence engine: deterministic from quote id + year + version.
export function buildQuoteDocumentNumber(version: QuoteVersion): string {
  const sourceDate = version.sentAt ?? version.createdAt;
  const year = sourceDate.getUTCFullYear();
  const seedHex = version.quoteId.replace(/-/g, "").slice(0, 8);
  const seed = Number.parseInt(seedHex, 16);
  const serial = Number.isFinite(seed) ? ((seed % 1000) + 1).toString().padStart(3, "0") : "001";
  return `DEV-${year}-${serial} / v${version.versionNumber}`;
}
