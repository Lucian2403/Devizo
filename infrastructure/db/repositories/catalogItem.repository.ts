import { and, eq, asc, or, ilike, sql, isNotNull } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { catalogItems, catalogCategories } from "@/infrastructure/db/schema";
import {
  DuplicateItemCodeError,
  type CatalogItem,
  type CatalogItemData,
  type CatalogItemRepository,
  type SemanticCandidate,
  type EmbeddingInputRow,
  type EmbeddingWriteRow,
} from "@/domain/catalog/item.repository";
import type {
  CatalogItemId,
  CatalogItemType,
  OrganizationId,
  SupportedCurrency,
  SupportedUnit,
} from "@/domain/shared/types";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

function toDomain(row: typeof catalogItems.$inferSelect): CatalogItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    categoryId: row.categoryId,
    code: row.code,
    name: row.name,
    description: row.description,
    unit: row.unit as SupportedUnit,
    itemType: row.itemType as CatalogItemType,
    sellingPrice: row.sellingPrice,
    costPrice: row.costPrice,
    currency: row.currency as SupportedCurrency,
    active: row.active,
  };
}

function toColumns(data: CatalogItemData) {
  return {
    categoryId: data.categoryId ?? null,
    code: data.code ?? null,
    name: data.name,
    description: data.description ?? null,
    unit: data.unit,
    itemType: data.itemType,
    sellingPrice: data.sellingPrice,
    costPrice: data.costPrice ?? null,
    currency: data.currency,
    active: data.active,
  };
}

function splitSearchTokens(term: string): string[] {
  return [
    ...new Set(
      term
        .trim()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length >= 2),
    ),
  ];
}

export class DrizzleCatalogItemRepository implements CatalogItemRepository {
  async listActive(organizationId: OrganizationId): Promise<CatalogItem[]> {
    const rows = await db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.organizationId, organizationId),
          eq(catalogItems.active, true),
        ),
      )
      .orderBy(asc(catalogItems.name));

    return rows.map(toDomain);
  }

  async listAll(organizationId: OrganizationId): Promise<CatalogItem[]> {
    const rows = await db
      .select()
      .from(catalogItems)
      .where(eq(catalogItems.organizationId, organizationId))
      .orderBy(asc(catalogItems.name));

    return rows.map(toDomain);
  }

  async searchActive(
    organizationId: OrganizationId,
    term: string,
    limit: number,
    itemType?: CatalogItemType,
    currency?: SupportedCurrency,
  ): Promise<CatalogItem[]> {
    const pattern = `%${term.trim()}%`;
    const tokenPatterns = splitSearchTokens(term).map((token) => `%${token}%`);
    const searchClauses = [
      ilike(catalogItems.name, pattern),
      ilike(catalogItems.code, pattern),
      ilike(catalogItems.description, pattern),
      ...tokenPatterns.flatMap((tokenPattern) => [
        ilike(catalogItems.name, tokenPattern),
        ilike(catalogItems.code, tokenPattern),
        ilike(catalogItems.description, tokenPattern),
      ]),
    ];

    const rows = await db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.organizationId, organizationId),
          eq(catalogItems.active, true),
          itemType ? eq(catalogItems.itemType, itemType) : undefined,
          currency ? eq(catalogItems.currency, currency) : undefined,
          or(...searchClauses),
        ),
      )
      .orderBy(asc(catalogItems.name))
      .limit(limit);

    return rows.map(toDomain);
  }

  async getById(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
  ): Promise<CatalogItem | null> {
    const [row] = await db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.organizationId, organizationId),
          eq(catalogItems.id, itemId),
        ),
      )
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async findByCode(
    organizationId: OrganizationId,
    code: string,
  ): Promise<CatalogItem | null> {
    const [row] = await db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.organizationId, organizationId),
          eq(catalogItems.code, code),
        ),
      )
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async create(
    organizationId: OrganizationId,
    data: CatalogItemData,
  ): Promise<CatalogItem> {
    try {
      const [row] = await db
        .insert(catalogItems)
        .values({ organizationId, ...toColumns(data) })
        .returning();

      return toDomain(row!);
    } catch (error) {
      if (isUniqueViolation(error) && data.code) {
        throw new DuplicateItemCodeError(data.code);
      }
      throw error;
    }
  }

  async update(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
    data: CatalogItemData,
  ): Promise<CatalogItem> {
    try {
      const [row] = await db
        .update(catalogItems)
        .set({ ...toColumns(data), updatedAt: new Date() })
        .where(
          and(
            eq(catalogItems.organizationId, organizationId),
            eq(catalogItems.id, itemId),
          ),
        )
        .returning();

      return toDomain(row!);
    } catch (error) {
      if (isUniqueViolation(error) && data.code) {
        throw new DuplicateItemCodeError(data.code);
      }
      throw error;
    }
  }

  async setActive(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
    active: boolean,
  ): Promise<void> {
    await db
      .update(catalogItems)
      .set({ active, updatedAt: new Date() })
      .where(
        and(
          eq(catalogItems.organizationId, organizationId),
          eq(catalogItems.id, itemId),
        ),
      );
  }

  async bulkUpsert(
    organizationId: OrganizationId,
    creates: CatalogItemData[],
    updates: { id: CatalogItemId; data: CatalogItemData }[],
  ): Promise<{ created: number; updated: number }> {
    return db.transaction(async (tx) => {
      for (const data of creates) {
        await tx
          .insert(catalogItems)
          .values({ organizationId, ...toColumns(data) });
      }

      for (const { id, data } of updates) {
        await tx
          .update(catalogItems)
          .set({ ...toColumns(data), updatedAt: new Date() })
          .where(
            and(
              eq(catalogItems.organizationId, organizationId),
              eq(catalogItems.id, id),
            ),
          );
      }

      return { created: creates.length, updated: updates.length };
    });
  }

  async semanticSearch(
    organizationId: OrganizationId,
    queryEmbedding: number[],
    itemType: CatalogItemType,
    limit: number,
    currency?: SupportedCurrency,
  ): Promise<SemanticCandidate[]> {
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const distance = sql<number>`${catalogItems.embedding} <=> ${vectorLiteral}::vector`;

    const rows = await db
      .select({ row: catalogItems, distance })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.organizationId, organizationId),
          eq(catalogItems.active, true),
          eq(catalogItems.itemType, itemType),
          currency ? eq(catalogItems.currency, currency) : undefined,
          isNotNull(catalogItems.embedding),
        ),
      )
      .orderBy(distance)
      .limit(limit);

    return rows.map(({ row, distance: value }) => ({
      item: toDomain(row),
      similarity: Math.max(0, Math.min(1, 1 - Number(value))),
    }));
  }

  async listEmbeddingInputs(
    organizationId: OrganizationId,
  ): Promise<EmbeddingInputRow[]> {
    const rows = await db
      .select({
        id: catalogItems.id,
        name: catalogItems.name,
        description: catalogItems.description,
        categoryName: catalogCategories.name,
        itemType: catalogItems.itemType,
        unit: catalogItems.unit,
        storedHash: catalogItems.embeddingSource,
      })
      .from(catalogItems)
      .leftJoin(
        catalogCategories,
        eq(catalogItems.categoryId, catalogCategories.id),
      )
      .where(
        and(
          eq(catalogItems.organizationId, organizationId),
          eq(catalogItems.active, true),
        ),
      );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      categoryName: row.categoryName,
      itemType: row.itemType as CatalogItemType,
      unit: row.unit as SupportedUnit,
      storedHash: row.storedHash,
    }));
  }

  async saveEmbeddings(rows: EmbeddingWriteRow[]): Promise<void> {
    if (rows.length === 0) return;

    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .update(catalogItems)
          .set({
            embedding: row.embedding,
            embeddingSource: row.hash,
            embeddingModel: row.model,
            embeddingUpdatedAt: new Date(),
          })
          .where(eq(catalogItems.id, row.id));
      }
    });
  }
}
