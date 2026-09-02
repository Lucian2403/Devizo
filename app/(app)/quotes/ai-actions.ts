"use server";

import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getEstimateAssistantService } from "@/server/container";
import { ExtractionError } from "@/domain/ai/providers";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/domain/shared/types";
import type { ExtractionResult } from "@/domain/ai/extraction.types";

// Server-side input limit. Keeps prompt cost bounded and blocks abuse; there is
// no in-memory rate limiter (it wouldn't be reliable on serverless).
const MAX_INPUT_CHARS = 4000;

export type ExtractState =
  | { ok: true; result: ExtractionResult }
  | { ok: false; error: string };

// Runs AI extraction + multilingual catalog matching for typed text. Nothing is
// persisted; the client reviews and explicitly confirms before items are added.
export async function extractFromText(text: string): Promise<ExtractState> {
  const { org } = await requireCurrentOrg();

  const trimmed = (text ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Introduceți o descriere." };
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    return { ok: false, error: "Textul este prea lung." };
  }

  // The catalog language biases the search terms the model generates.
  const catalogLanguage = (
    SUPPORTED_LANGUAGES as readonly string[]
  ).includes(org.defaultLanguage)
    ? (org.defaultLanguage as SupportedLanguage)
    : "en";

  try {
    const result = await getEstimateAssistantService().assist(
      org.id,
      catalogLanguage,
      trimmed,
    );
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ExtractionError) {
      return { ok: false, error: error.message };
    }
    // A missing API key is a configuration problem, not a model failure —
    // surface a distinct, actionable message.
    if (error instanceof Error && error.message.includes("API_KEY")) {
      return {
        ok: false,
        error: "Asistentul AI nu este configurat (lipsește cheia API).",
      };
    }
    // Don't leak provider/internal details to the client.
    console.error("AI extraction failed:", error);
    return { ok: false, error: "Asistentul AI nu este disponibil momentan." };
  }
}
