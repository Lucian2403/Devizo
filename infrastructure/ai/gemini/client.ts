/**
 * Minimal Google Gemini REST client. We call the HTTP API with fetch to avoid
 * adding an SDK dependency. Everything here is server-only; the API key must
 * never be exposed to the browser.
 */

export interface GeminiConfig {
  apiKey: string;
  extractionModel: string;
  baseUrl: string;
}

// Reads and validates the Gemini-related environment configuration.
export function readGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  return {
    apiKey,
    extractionModel: process.env.AI_EXTRACTION_MODEL ?? "gemini-3.5-flash-lite",
    baseUrl:
      process.env.GEMINI_BASE_URL ??
      "https://generativelanguage.googleapis.com/v1beta",
  };
}

// A JSON schema describing the structured response Gemini must return.
export type GeminiResponseSchema = Record<string, unknown>;

// POSTs a generateContent request configured for structured JSON output and
// returns the raw model text (which is a JSON string).
export async function generateJson(
  config: GeminiConfig,
  systemInstruction: string,
  userText: string,
  responseSchema: GeminiResponseSchema,
): Promise<string> {
  const url =
    `${config.baseUrl}/models/${config.extractionModel}:generateContent` +
    `?key=${encodeURIComponent(config.apiKey)}`;

  const body = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini returned no content.");
  return content;
}
