import {
  type EmbeddingProvider,
  EmbeddingError,
} from "@/domain/ai/embedding.provider";

/**
 * Google Gemini embedding adapter (M5.1). Uses the REST `batchEmbedContents`
 * endpoint via fetch — no SDK. Server-only; the API key must never reach the
 * browser. Reuses the same key/base URL as the extraction client.
 *
 * Model and output dimensionality are configurable, but the catalog schema
 * fixes the stored vector size (768). If you change dimensions you MUST also
 * change the column type and re-embed the whole catalog.
 */
export interface GeminiEmbeddingConfig {
  apiKey: string;
  model: string;
  dimensions: number;
  baseUrl: string;
}

const DEFAULT_MODEL = "gemini-embedding-2";
const DEFAULT_DIMENSIONS = 768;

export function readGeminiEmbeddingConfig(): GeminiEmbeddingConfig {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new EmbeddingError("GEMINI_API_KEY is not set.");

  const dimensions = process.env.AI_EMBEDDING_DIMENSIONS
    ? Number(process.env.AI_EMBEDDING_DIMENSIONS)
    : DEFAULT_DIMENSIONS;
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new EmbeddingError(
      `Invalid AI_EMBEDDING_DIMENSIONS: ${process.env.AI_EMBEDDING_DIMENSIONS}`,
    );
  }

  return {
    apiKey,
    model: process.env.AI_EMBEDDING_MODEL ?? DEFAULT_MODEL,
    dimensions,
    baseUrl:
      process.env.GEMINI_BASE_URL ??
      "https://generativelanguage.googleapis.com/v1beta",
  };
}

// Gemini caps batch size for batchEmbedContents; the free tier also counts
// each item in a batch as one request-per-minute. Keep batches modest and rely
// on 429 backoff below to stay under the quota on large catalogs.
const MAX_BATCH = 50;
// How many times to retry a rate-limited (429) batch before giving up.
const MAX_RETRIES = 6;
// Fallback wait when the API does not tell us how long to back off.
const DEFAULT_RETRY_MS = 22_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extracts the suggested retry delay (in ms) from a Gemini 429 error body.
function parseRetryDelayMs(detail: string): number {
  const match = detail.match(/"retryDelay":\s*"(\d+)(?:\.\d+)?s"/);
  if (match) return (Number(match[1]) + 1) * 1000;
  return DEFAULT_RETRY_MS;
}

interface BatchEmbedResponse {
  embeddings?: { values?: number[] }[];
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly config: GeminiEmbeddingConfig;

  constructor(config?: GeminiEmbeddingConfig) {
    this.config = config ?? readGeminiEmbeddingConfig();
  }

  get model(): string {
    return this.config.model;
  }

  get dimensions(): number {
    return this.config.dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH) {
      const slice = texts.slice(i, i + MAX_BATCH);
      const vectors = await this.embedBatch(slice);
      out.push(...vectors);
    }
    return out;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const modelPath = `models/${this.config.model}`;
    const url =
      `${this.config.baseUrl}/${modelPath}:batchEmbedContents` +
      `?key=${encodeURIComponent(this.config.apiKey)}`;

    const body = {
      requests: texts.map((text) => ({
        model: modelPath,
        content: { parts: [{ text }] },
        outputDimensionality: this.config.dimensions,
      })),
    };

    let response: Response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (error) {
        throw new EmbeddingError("Gemini embedding request failed.", {
          cause: error,
        });
      }

      if (response.ok) break;

      const detail = await response.text().catch(() => "");
      // Back off and retry on rate limiting; the free tier is per-minute.
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const waitMs = parseRetryDelayMs(detail);
        console.warn(
          `Embedding rate-limited (429); retrying in ${Math.round(waitMs / 1000)}s ` +
            `(attempt ${attempt + 1}/${MAX_RETRIES}).`,
        );
        await sleep(waitMs);
        continue;
      }
      throw new EmbeddingError(
        `Gemini embedding request failed (${response.status}): ${detail}`,
      );
    }

    const data = (await response.json()) as BatchEmbedResponse;
    const embeddings = data.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new EmbeddingError(
        `Gemini returned ${embeddings.length} embeddings for ${texts.length} inputs.`,
      );
    }

    return embeddings.map((item, index) => {
      const values = item.values;
      if (!values || values.length !== this.config.dimensions) {
        throw new EmbeddingError(
          `Embedding ${index} has ${values?.length ?? 0} dims, expected ${this.config.dimensions}.`,
        );
      }
      return values;
    });
  }
}
