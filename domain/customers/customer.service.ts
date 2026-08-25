import type { CustomerId, OrganizationId } from "@/domain/shared/types";
import type {
  Customer,
  CustomerData,
  CustomerRepository,
} from "./customer.repository";

export class CustomerNotFoundError extends Error {
  constructor() {
    super("Customer not found.");
    this.name = "CustomerNotFoundError";
  }
}

/**
 * Business logic for customers. Depends only on the repository port.
 * Customers are archived, never hard-deleted.
 */
export class CustomerService {
  constructor(private readonly repository: CustomerRepository) {}

  listCustomers(organizationId: OrganizationId): Promise<Customer[]> {
    return this.repository.listActive(organizationId);
  }

  listArchivedCustomers(organizationId: OrganizationId): Promise<Customer[]> {
    return this.repository.listArchived(organizationId);
  }

  async getCustomer(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<Customer> {
    const customer = await this.repository.getById(organizationId, customerId);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }

  createCustomer(
    organizationId: OrganizationId,
    data: CustomerData,
  ): Promise<Customer> {
    return this.repository.create(organizationId, data);
  }

  updateCustomer(
    organizationId: OrganizationId,
    customerId: CustomerId,
    data: CustomerData,
  ): Promise<Customer> {
    return this.repository.update(organizationId, customerId, data);
  }

  archiveCustomer(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<void> {
    return this.repository.setArchived(organizationId, customerId, true);
  }

  restoreCustomer(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<void> {
    return this.repository.setArchived(organizationId, customerId, false);
  }
}
