import type {
  CustomerId,
  OrganizationId,
  SupportedLanguage,
} from "@/domain/shared/types";

export interface Customer {
  id: CustomerId;
  organizationId: OrganizationId;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  preferredLanguage: SupportedLanguage | null;
  notes: string | null;
  archivedAt: Date | null;
}

// Fields a user can set when creating or editing a customer.
export interface CustomerData {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: SupportedLanguage;
  notes?: string;
}

/**
 * Port owned by the domain. The infrastructure layer implements it with Drizzle.
 */
export interface CustomerRepository {
  // Active = not archived. Archived customers are fetched separately.
  listActive(organizationId: OrganizationId): Promise<Customer[]>;
  listArchived(organizationId: OrganizationId): Promise<Customer[]>;
  getById(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<Customer | null>;
  create(
    organizationId: OrganizationId,
    data: CustomerData,
  ): Promise<Customer>;
  update(
    organizationId: OrganizationId,
    customerId: CustomerId,
    data: CustomerData,
  ): Promise<Customer>;
  setArchived(
    organizationId: OrganizationId,
    customerId: CustomerId,
    archived: boolean,
  ): Promise<void>;
}
