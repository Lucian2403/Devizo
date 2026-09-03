import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/domain/shared/types";
import {
  TranscriptionError,
  type TranscriptionProvider,
  type TranscriptionResult,
} from "@/domain/ai/transcription.provider";
import { readGeminiConfig } from "./client";

/**
 * Gemini-backed speech-to-text. Uses the REST `generateContent` endpoint with
 * an inline (base64) audio part — no SDK, no file upload API, no persistence.
 * Server-only; the API key must never reach the browser.
 *
 * The model is asked to transcribe verbatim and keep the original language(s),
 * including mixed Romanian/Russian speech. All understanding happens later in
 * the existing text extraction flow, so this provider never extracts or
 * translates.
 */
const TRANSCRIPTION_PROMPT = [
  "Transcribe the spoken audio VERBATIM.",
  "Keep the original language exactly as spoken. Do NOT translate.",
  "The speaker may mix languages (e.g. Romanian and Russian) in one sentence — keep every word in its original language.",
  "Return ONLY the transcript text, with no quotes, labels or commentary.",
  "If there is no intelligible speech, return an empty string.",
].join("\n");

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  async transcribe(
    audio: Uint8Array,
    mimeType: string,
  ): Promise<TranscriptionResult> {
    const config = readGeminiConfig();
    const model = process.env.AI_TRANSCRIPTION_MODEL ?? config.extractionModel;

    const url =
      `${config.baseUrl}/models/${model}:generateContent` +
      `?key=${encodeURIComponent(config.apiKey)}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: TRANSCRIPTION_PROMPT },
            {
              inlineData: {
                mimeType,
                data: Buffer.from(audio).toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new TranscriptionError("Transcription provider unavailable.", error);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new TranscriptionError(
        `Transcription request failed (${response.status}): ${detail}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? ""
    ).trim();

    return { text, detectedLanguage: guessLanguage(text) };
  }
}

// The transcript is not tagged with a language by Gemini here, so we leave this
// undefined; the extraction step detects language on its own. Kept as a hook in
// case a future provider returns a reliable language code.
function guessLanguage(_text: string): SupportedLanguage | undefined {
  void SUPPORTED_LANGUAGES;
  return undefined;
}
