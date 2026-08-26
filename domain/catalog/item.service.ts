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
