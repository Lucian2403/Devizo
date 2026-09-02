/**
 * Minimal OpenAI REST client. We call the HTTP API with fetch to avoid adding
 * an SDK dependency. Everything here is server-only; the API key must never be
 * exposed to the browser.
 */

export interface OpenAIConfig {
  apiKey: string;
  extractionModel: string;
  baseUrl: string;
}

// Reads and validates the OpenAI-related environment configuration.
export function readOpenAIConfig(): OpenAIConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return {
    apiKey,
    extractionModel: process.env.AI_EXTRACTION_MODEL ?? "gpt-4o-mini",
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  };
}

// POSTs a chat completion and returns the raw assistant message content string.
export async function chatCompletion(
  config: OpenAIConfig,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content.");
  return content;
}
