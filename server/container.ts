import { OrganizationService } from "@/domain/organizations/organization.service";
import { DrizzleOrganizationRepository } from "@/infrastructure/db/repositories/organization.repository";
import { CustomerService } from "@/domain/customers/customer.service";
import { DrizzleCustomerRepository } from "@/infrastructure/db/repositories/customer.repository";
import { ProjectService } from "@/domain/projects/project.service";
import { DrizzleProjectRepository } from "@/infrastructure/db/repositories/project.repository";
import { CatalogCategoryService } from "@/domain/catalog/category.service";
import { DrizzleCatalogCategoryRepository } from "@/infrastructure/db/repositories/catalogCategory.repository";
import { CatalogItemService } from "@/domain/catalog/item.service";
import { DrizzleCatalogItemRepository } from "@/infrastructure/db/repositories/catalogItem.repository";

/**
 * Wires domain services to their Drizzle adapters in one place,
 * so pages and actions stay thin.
 */
export function getOrganizationService(): OrganizationService {
  return new OrganizationService(new DrizzleOrganizationRepository());
}

export function getCustomerService(): CustomerService {
  return new CustomerService(new DrizzleCustomerRepository());
}

export function getProjectService(): ProjectService {
  return new ProjectService(new DrizzleProjectRepository());
}

export function getCatalogCategoryService(): CatalogCategoryService {
  return new CatalogCategoryService(new DrizzleCatalogCategoryRepository());
}

export function getCatalogItemService(): CatalogItemService {
  return new CatalogItemService(new DrizzleCatalogItemRepository());
}

// The import flow uses item bulk upsert directly on the repository.
export function getCatalogItemRepository(): DrizzleCatalogItemRepository {
  return new DrizzleCatalogItemRepository();
}
