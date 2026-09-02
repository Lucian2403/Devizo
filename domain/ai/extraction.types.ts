import type {
  CatalogItemType,
  SupportedLanguage,
  SupportedUnit,
} from "@/domain/shared/types";
import type { WorkAction, WorkObject } from "./concepts";

/**
 * Types for AI-assisted estimate extraction. The AI layer NEVER handles money:
 * there are no price/total/VAT/discount fields here by design. Prices come only
 * from the company catalog or explicit manual user input, downstream.
 */

// A language the extractor may report, plus "unknown" when it cannot tell.
export type DetectedLanguage = SupportedLanguage | "unknown";

// One work item the AI extracted from free text. Quantity is a decimal STRING
// (or null) — never a JS float — so it flows cleanly into the pricing layer.
export interface ExtractedItem {
  // A canonical-ish concept label, e.g. "REMOVE_FLOOR_TILES". Free text.
  concept: string;
  // Whether the requirement is LABOR (a work operation) or MATERIAL (a product).
  // Matching only ever searches catalog items of the same type.
  kind: CatalogItemType;
  // Canonical action performed (remove/install/prepare/finish/repair/other).
  action: WorkAction;
  // Canonical object acted upon, or null when the item has no clear object.
  object: WorkObject | null;
  // Free-text surface/context, e.g. "wall", "ceiling", "bathroom", or null.
  surface: string | null;
  // A short normalized, language-neutral concept phrase (for display/debug).
  normalizedConcept: string;
  // The phrase in the original input this item came from.
  rawText: string;
  // Human-readable description in the detected language.
  description: string;
  // Decimal quantity as a string, or null when the user didn't state one.
  quantity: string | null;
  // Canonical unit, or null when unclear (requires manual review).
  unit: SupportedUnit | null;
  // Model confidence 0..1. Low values force manual review.
  confidence: number;
  // Search terms/synonyms in the organization's catalog language, used to
  // retrieve real catalog candidates server-side (multilingual bridge).
  searchTerms: string[];
}

// The full validated extraction returned by the provider.
export interface JobExtraction {
  detectedLanguage: DetectedLanguage;
  items: ExtractedItem[];
  assumptions: string[];
  missingInformation: string[];
}

// One catalog candidate offered for an extracted item. Price/unit come from the
// authoritative catalog, not from the AI.
export interface MatchCandidate {
  catalogItemId: string;
  name: string;
  code: string | null;
  unit: SupportedUnit;
  sellingPrice: string;
  score: number;
}

// How an extracted item matched against the catalog. Ordered by confidence:
//   matched   (HIGH)     — safe to preselect the top candidate.
//   review    (MEDIUM)   — candidate shown but must be reviewed.
//   low       (LOW)      — candidates shown, nothing preselected.
//   unmatched (NO_MATCH) — no compatible candidate; catalog left empty.
export type MatchStatus = "matched" | "review" | "low" | "unmatched";

// An extracted item paired with its catalog candidates and a match verdict.
export interface MatchedItem {
  item: ExtractedItem;
  status: MatchStatus;
  candidates: MatchCandidate[];
  // Pre-selected candidate id for "matched"; null for ambiguous/unmatched.
  suggestedCatalogItemId: string | null;
}

// The complete result the review UI renders. Nothing here is persisted.
export interface ExtractionResult {
  detectedLanguage: DetectedLanguage;
  items: MatchedItem[];
  assumptions: string[];
  missingInformation: string[];
}
