import { OrganizationService } from "@/domain/organizations/organization.service";
import { DrizzleOrganizationRepository } from "@/infrastructure/db/repositories/organization.repository";

/**
 * Wires the organization domain service to its Drizzle adapter.
 * Keeps composition in one place so pages/actions stay thin.
 */
export function getOrganizationService(): OrganizationService {
  return new OrganizationService(new DrizzleOrganizationRepository());
}
