import { and, eq, sql, asc } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { catalogCategories } from "@/infrastructure/db/schema";
import type {
  CatalogCategory,
  CatalogCategoryRepository,
} from "@/domain/catalog/category.repository";
import type {
  CatalogCategoryId,
  OrganizationId,
} from "@/domain/shared/types";

function toDomain(row: typeof catalogCategories.$inferSelect): CatalogCategory {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
  };
}

export class DrizzleCatalogCategoryRepository
  implements CatalogCategoryRepository
{
  async list(organizationId: OrganizationId): Promise<CatalogCategory[]> {
    const rows = await db
      .select()
      .from(catalogCategories)
      .where(eq(catalogCategories.organizationId, organizationId))
      .orderBy(asc(catalogCategories.name));
    return rows.map(toDomain);
  }

  async getById(
    organizationId: OrganizationId,
    categoryId: CatalogCategoryId,
  ): Promise<CatalogCategory | null> {
    const [row] = await db
      .select()
      .from(catalogCategories)
      .where(
        and(
          eq(catalogCategories.organizationId, organizationId),
          eq(catalogCategories.id, categoryId),
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByName(
    organizationId: OrganizationId,
    name: string,
  ): Promise<CatalogCategory | null> {
    const [row] = await db
      .select()
      .from(catalogCategories)
      .where(
        and(
          eq(catalogCategories.organizationId, organizationId),
          // Case-insensitive name match.
          sql`lower(${catalogCategories.name}) = lower(${name})`,
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async create(
    organizationId: OrganizationId,
    name: string,
  ): Promise<CatalogCategory> {
    const [row] = await db
      .insert(catalogCategories)
      .values({ organizationId, name })
      .returning();
    return toDomain(row!);
  }

  async rename(
    organizationId: OrganizationId,
    categoryId: CatalogCategoryId,
    name: string,
  ): Promise<CatalogCategory> {
    const [row] = await db
      .update(catalogCategories)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(catalogCategories.organizationId, organizationId),
          eq(catalogCategories.id, categoryId),
        ),
      )
      .returning();
    return toDomain(row!);
  }
}
