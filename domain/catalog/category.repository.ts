import type {
  CatalogCategoryId,
  OrganizationId,
} from "@/domain/shared/types";

export interface CatalogCategory {
  id: CatalogCategoryId;
  organizationId: OrganizationId;
  name: string;
}

export interface CatalogCategoryRepository {
  list(organizationId: OrganizationId): Promise<CatalogCategory[]>;
  getById(
    organizationId: OrganizationId,
    categoryId: CatalogCategoryId,
  ): Promise<CatalogCategory | null>;
  // Returns an existing category with the same name (case-insensitive) or null.
  findByName(
    organizationId: OrganizationId,
    name: string,
  ): Promise<CatalogCategory | null>;
  create(
    organizationId: OrganizationId,
    name: string,
  ): Promise<CatalogCategory>;
  rename(
    organizationId: OrganizationId,
    categoryId: CatalogCategoryId,
    name: string,
  ): Promise<CatalogCategory>;
}
