import type {
  CatalogCategoryId,
  CatalogItemId,
  OrganizationId,
  SupportedUnit,
} from "@/domain/shared/types";

export interface CatalogItem {
  id: CatalogItemId;
  organizationId: OrganizationId;
  categoryId: CatalogCategoryId | null;
  code: string | null;
  name: string;
  description: string | null;
  unit: SupportedUnit;
  // Money is kept as a canonical decimal string, never a JS float.
  sellingPrice: string;
  costPrice: string | null;
  active: boolean;
}

// Fields a user can set when creating or editing an item.
// Prices arrive already normalized to canonical decimal strings.
export interface CatalogItemData {
  categoryId?: CatalogCategoryId | null;
  code?: string | null;
  name: string;
  description?: string | null;
  unit: SupportedUnit;
  sellingPrice: string;
  costPrice?: string | null;
  active: boolean;
}

export class DuplicateItemCodeError extends Error {
  constructor(public readonly code: string) {
    super(`An item with code "${code}" already exists.`);
    this.name = "DuplicateItemCodeError";
  }
}

export interface CatalogItemRepository {
  listActive(organizationId: OrganizationId): Promise<CatalogItem[]>;
  listAll(organizationId: OrganizationId): Promise<CatalogItem[]>;
  // Search-as-you-type over active items by name or code (limited result set).
  searchActive(
    organizationId: OrganizationId,
    term: string,
    limit: number,
  ): Promise<CatalogItem[]>;
  getById(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
  ): Promise<CatalogItem | null>;
  // Looks an item up by its code within the organization (for import matching).
  findByCode(
    organizationId: OrganizationId,
    code: string,
  ): Promise<CatalogItem | null>;
  create(
    organizationId: OrganizationId,
    data: CatalogItemData,
  ): Promise<CatalogItem>;
  update(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
    data: CatalogItemData,
  ): Promise<CatalogItem>;
  setActive(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
    active: boolean,
  ): Promise<void>;
  // Bulk create/update used by import, run inside a single transaction.
  bulkUpsert(
    organizationId: OrganizationId,
    creates: CatalogItemData[],
    updates: { id: CatalogItemId; data: CatalogItemData }[],
  ): Promise<{ created: number; updated: number }>;
}
