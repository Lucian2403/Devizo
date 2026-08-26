import { and, eq, asc, or, ilike } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { catalogItems } from "@/infrastructure/db/schema";
import {
  DuplicateItemCodeError,
  type CatalogItem,
  type CatalogItemData,
  type CatalogItemRepository,
} from "@/domain/catalog/item.repository";
import type {
  CatalogItemId,
  OrganizationId,
  SupportedUnit,
} from "@/domain/shared/types";

// Postgres unique-violation code, raised by the per-org code index.
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
    sellingPrice: row.sellingPrice,
    costPrice: row.costPrice,
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
    sellingPrice: data.sellingPrice,
    costPrice: data.costPrice ?? null,
    active: data.active,
  };
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
  ): Promise<CatalogItem[]> {
    // Case-insensitive match on name or code. Uses ILIKE so it works well for
    // large catalogs without loading everything into the client.
    const pattern = `%${term}%`;
    const rows = await db
      .select()
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.organizationId, organizationId),
          eq(catalogItems.active, true),
          or(
            ilike(catalogItems.name, pattern),
            ilike(catalogItems.code, pattern),
          ),
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
}
