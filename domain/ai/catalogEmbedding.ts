import { createHash } from "node:crypto";
import type { CatalogItemType, SupportedUnit } from "@/domain/shared/types";
import type { EmbeddingProvider } from "./embedding.provider";

/**
 * Catalog embedding lifecycle (M5.1).
 *
 * The embed-text is built ONLY from semantic fields (name, description,
 * category, item_type, unit). Its hash is the change detector: when only a
 * non-semantic field such as price changes, the hash is identical and we skip
 * re-embedding. Prices never touch the vector.
 */

// The semantic fields that define an item's embedding. Deliberately excludes
// price, code, active and timestamps.
export interface EmbedFields {
  name: string;
  description: string | null;
  categoryName: string | null;
  itemType: CatalogItemType;
  unit: SupportedUnit;
}

// Builds a deterministic, provider-neutral text for embedding. Field labels are
// language-neutral tags so the vector captures structure, not just prose.
export function buildEmbedText(fields: EmbedFields): string {
  const lines = [
    `name: ${fields.name.trim()}`,
    `description: ${(fields.description ?? "").trim()}`,
    `category: ${(fields.categoryName ?? "").trim()}`,
    `type: ${fields.itemType}`,
    `unit: ${fields.unit}`,
  ];
  return lines.join("\n");
}

// Stable hash of the embed-text, stored as embedding_source. Same text → same
// hash → no re-embedding.
export function embedTextHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// One item queued for embedding: its id plus the freshly built text/hash.
export interface EmbeddingWorkItem {
  id: string;
  text: string;
  hash: string;
}

// The result to persist for one item.
export interface EmbeddingResult {
  id: string;
  embedding: number[];
  hash: string;
  model: string;
}

/**
 * Coordinates the embedding provider. Pure of persistence — callers pass in the
 * items that actually need (re)embedding and persist the returned results. This
 * keeps the service testable with a fake provider and free of DB coupling.
 */
export class CatalogEmbeddingService {
  constructor(private readonly provider: EmbeddingProvider) {}

  get model(): string {
    return this.provider.model;
  }

  // Returns true when the stored hash differs from the current embed-text hash
  // (or there is no stored hash yet) — i.e. the item needs re-embedding.
  needsEmbedding(currentHash: string, storedHash: string | null): boolean {
    return storedHash !== currentHash;
  }

  // Embeds a set of work items in provider-batched calls, preserving order.
  async embedItems(items: EmbeddingWorkItem[]): Promise<EmbeddingResult[]> {
    if (items.length === 0) return [];
    const vectors = await this.provider.embed(items.map((i) => i.text));
    return items.map((item, index) => ({
      id: item.id,
      embedding: vectors[index]!,
      hash: item.hash,
      model: this.provider.model,
    }));
  }
}
