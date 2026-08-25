import { OrganizationService } from "@/domain/organizations/organization.service";
import { DrizzleOrganizationRepository } from "@/infrastructure/db/repositories/organization.repository";
import { CustomerService } from "@/domain/customers/customer.service";
import { DrizzleCustomerRepository } from "@/infrastructure/db/repositories/customer.repository";

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
