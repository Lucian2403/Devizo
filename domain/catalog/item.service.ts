import type {
  CatalogItemId,
  OrganizationId,
} from "@/domain/shared/types";
import type {
  CatalogItem,
  CatalogItemData,
  CatalogItemRepository,
} from "./item.repository";

export class CatalogItemNotFoundError extends Error {
  constructor() {
    super("Item not found.");
    this.name = "CatalogItemNotFoundError";
  }
}

/**
 * Business logic for catalog items. All prices use the organization's default
 * currency; money is handled as decimal strings, never JS floats.
 */
export class CatalogItemService {
  constructor(private readonly repository: CatalogItemRepository) {}

  listItems(organizationId: OrganizationId): Promise<CatalogItem[]> {
    return this.repository.listAll(organizationId);
  }

  listActiveItems(organizationId: OrganizationId): Promise<CatalogItem[]> {
    return this.repository.listActive(organizationId);
  }

  // Search-as-you-type used by the quote editor's catalog picker.
  searchActiveItems(
    organizationId: OrganizationId,
    term: string,
  ): Promise<CatalogItem[]> {
    const trimmed = term.trim();
    if (trimmed.length === 0) return Promise.resolve([]);
    return this.repository.searchActive(organizationId, trimmed, 20);
  }

  async getItem(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
  ): Promise<CatalogItem> {
    const item = await this.repository.getById(organizationId, itemId);
    if (!item) throw new CatalogItemNotFoundError();
    return item;
  }

  createItem(
    organizationId: OrganizationId,
    data: CatalogItemData,
  ): Promise<CatalogItem> {
    return this.repository.create(organizationId, data);
  }

  updateItem(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
    data: CatalogItemData,
  ): Promise<CatalogItem> {
    return this.repository.update(organizationId, itemId, data);
  }

  setItemActive(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
    active: boolean,
  ): Promise<void> {
    return this.repository.setActive(organizationId, itemId, active);
  }
}
