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
import { QuoteService } from "@/domain/quotes/quote.service";
import { DrizzleQuoteRepository } from "@/infrastructure/db/repositories/quote.repository";
import { EstimateAssistantService } from "@/domain/ai/estimate.service";
import { GeminiExtractionProvider } from "@/infrastructure/ai/gemini/extraction.provider";

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

export function getQuoteService(): QuoteService {
  return new QuoteService(new DrizzleQuoteRepository());
}

// AI-assisted estimate extraction. The provider is created lazily so pages that
// don't use AI never require the AI API key to be set. Swapping providers here
// keeps the domain and application layers untouched.
export function getEstimateAssistantService(): EstimateAssistantService {
  return new EstimateAssistantService(
    new GeminiExtractionProvider(),
    new DrizzleCatalogItemRepository(),
  );
}
