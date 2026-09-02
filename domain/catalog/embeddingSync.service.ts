import type { OrganizationId } from "@/domain/shared/types";
import type { CatalogItemRepository } from "./item.repository";
import {
  CatalogEmbeddingService,
  buildEmbedText,
  embedTextHash,
  type EmbeddingWorkItem,
} from "@/domain/ai/catalogEmbedding";

/**
 * Keeps an organization's catalog embeddings in sync (M5.1).
 *
 * `syncOrganization` is idempotent and cheap: it lists the org's active items,
 * rebuilds each embed-text hash, and embeds ONLY the rows whose hash changed
 * (new items, or edits to semantic fields). Price-only edits produce the same
 * hash and are skipped. The same method serves create, update, import and
 * one-off backfill — callers never decide what to embed.
 */
export class CatalogEmbeddingSyncService {
  constructor(
    private readonly repository: CatalogItemRepository,
    private readonly embeddings: CatalogEmbeddingService,
  ) {}

  async syncOrganization(
    organizationId: OrganizationId,
  ): Promise<{ embedded: number; skipped: number }> {
    const inputs = await this.repository.listEmbeddingInputs(organizationId);

    const work: EmbeddingWorkItem[] = [];
    for (const row of inputs) {
      const text = buildEmbedText(row);
      const hash = embedTextHash(text);
      if (this.embeddings.needsEmbedding(hash, row.storedHash)) {
        work.push({ id: row.id, text, hash });
      }
    }

    const results = await this.embeddings.embedItems(work);
    await this.repository.saveEmbeddings(
      results.map((r) => ({
        id: r.id,
        embedding: r.embedding,
        hash: r.hash,
        model: r.model,
      })),
    );

    return { embedded: results.length, skipped: inputs.length - work.length };
  }
}
