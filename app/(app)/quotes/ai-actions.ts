"use server";

import { z } from "zod";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getEstimateAssistantService } from "@/server/container";
import { ExtractionError } from "@/domain/ai/providers";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/domain/shared/types";
import { isSupportedCurrency, type SupportedCurrency } from "@/domain/shared/types";
import type { ExtractionResult } from "@/domain/ai/extraction.types";
import { db } from "@/infrastructure/db";
import { catalogMatchFeedback } from "@/infrastructure/db/schema";

// Server-side input limit. Keeps prompt cost bounded and blocks abuse; there is
// no in-memory rate limiter (it wouldn't be reliable on serverless).
const MAX_INPUT_CHARS = 4000;

export type ExtractState =
  | { ok: true; result: ExtractionResult }
  | { ok: false; error: string };

const recalculatePayloadSchema = z.object({
  result: z.any(),
  values: z.record(z.union([z.string(), z.number(), z.boolean()])),
});

function resolveQuoteCurrency(
  requestedCurrency: string | undefined,
  organizationDefaultCurrency: string,
): SupportedCurrency | undefined {
  if (requestedCurrency && isSupportedCurrency(requestedCurrency)) {
    return requestedCurrency;
  }

  if (isSupportedCurrency(organizationDefaultCurrency)) {
    return organizationDefaultCurrency;
  }

  return undefined;
}

// Runs AI extraction + multilingual catalog matching for typed text. Nothing is
// persisted; the client reviews and explicitly confirms before items are added.
export async function extractFromText(
  text: string,
  currency?: string,
): Promise<ExtractState> {
  const { org } = await requireCurrentOrg();

  const trimmed = (text ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Introduceți o descriere." };
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    return { ok: false, error: "Textul este prea lung." };
  }

  const catalogLanguage = (
    SUPPORTED_LANGUAGES as readonly string[]
  ).includes(org.defaultLanguage)
    ? (org.defaultLanguage as SupportedLanguage)
    : "en";

  const quoteCurrency = resolveQuoteCurrency(currency, org.defaultCurrency);

  try {
    const result = await getEstimateAssistantService(quoteCurrency).assist(
      org.id,
      catalogLanguage,
      trimmed,
      quoteCurrency,
    );
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ExtractionError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.message.includes("API_KEY")) {
      return {
        ok: false,
        error: "Asistentul AI nu este configurat (lipsește cheia API).",
      };
    }
    console.error("AI extraction failed:", error);
    return { ok: false, error: "Asistentul AI nu este disponibil momentan." };
  }
}

// Applies user-provided missing-information values to the current extraction,
// then deterministically recalculates geometry/matching where needed.
export async function recalculateFromMissingInformation(input: {
  result: ExtractionResult;
  values: Record<string, string | number | boolean>;
  currency?: string;
}): Promise<ExtractState> {
  const { org } = await requireCurrentOrg();

  const parsed = recalculatePayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Date invalide pentru recalculare." };
  }

  const quoteCurrency = resolveQuoteCurrency(input.currency, org.defaultCurrency);

  try {
    const result = await getEstimateAssistantService(
      quoteCurrency,
    ).recalculateWithMissingInformation(
      org.id,
      parsed.data.result as ExtractionResult,
      parsed.data.values,
      quoteCurrency,
    );
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ExtractionError) {
      return { ok: false, error: error.message };
    }
    console.error("Missing-info recalculation failed:", error);
    return { ok: false, error: "Nu s-a putut recalcula devizul." };
  }
}

// Records what the user actually chose versus what the assistant suggested, so
// we can measure and later improve matching. Append-only, best-effort: a
// failure here must never block the user's quote. No learning loop yet.
export async function recordMatchFeedback(input: {
  extractedText: string;
  suggestedCatalogItemId: string | null;
  selectedCatalogItemId: string | null;
}): Promise<void> {
  try {
    const { org } = await requireCurrentOrg();
    const extractedText = (input.extractedText ?? "").trim();
    if (extractedText.length === 0) return;

    await db.insert(catalogMatchFeedback).values({
      organizationId: org.id,
      extractedText: extractedText.slice(0, MAX_INPUT_CHARS),
      suggestedCatalogItemId: input.suggestedCatalogItemId,
      selectedCatalogItemId: input.selectedCatalogItemId,
    });
  } catch (error) {
    console.error("Failed to record match feedback:", error);
  }
}
