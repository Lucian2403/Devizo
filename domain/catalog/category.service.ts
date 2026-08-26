import type {
  CatalogCategoryId,
  OrganizationId,
} from "@/domain/shared/types";
import type {
  CatalogCategory,
  CatalogCategoryRepository,
} from "./category.repository";

export class CatalogCategoryNotFoundError extends Error {
  constructor() {
    super("Category not found.");
    this.name = "CatalogCategoryNotFoundError";
  }
}

/**
 * Business logic for flat catalog categories (no hierarchy in the MVP).
 */
export class CatalogCategoryService {
  constructor(private readonly repository: CatalogCategoryRepository) {}

  listCategories(organizationId: OrganizationId): Promise<CatalogCategory[]> {
    return this.repository.list(organizationId);
  }

  createCategory(
    organizationId: OrganizationId,
    name: string,
  ): Promise<CatalogCategory> {
    return this.repository.create(organizationId, name);
  }

  async renameCategory(
    organizationId: OrganizationId,
    categoryId: CatalogCategoryId,
    name: string,
  ): Promise<CatalogCategory> {
    const existing = await this.repository.getById(organizationId, categoryId);
    if (!existing) throw new CatalogCategoryNotFoundError();
    return this.repository.rename(organizationId, categoryId, name);
  }

  // Finds a category by name, creating it if it does not exist yet.
  // Used by the import flow when a row names a not-yet-known category.
  async findOrCreateByName(
    organizationId: OrganizationId,
    name: string,
  ): Promise<CatalogCategory> {
    const found = await this.repository.findByName(organizationId, name);
    if (found) return found;
    return this.repository.create(organizationId, name);
  }
}
