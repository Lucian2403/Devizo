import { and, eq, isNull, isNotNull, desc } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { customers } from "@/infrastructure/db/schema";
import type {
  Customer,
  CustomerData,
  CustomerRepository,
} from "@/domain/customers/customer.repository";
import type {
  CustomerId,
  OrganizationId,
  SupportedLanguage,
} from "@/domain/shared/types";

function toDomain(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    preferredLanguage: row.preferredLanguage as SupportedLanguage | null,
    notes: row.notes,
    archivedAt: row.archivedAt,
  };
}

// Form fields are optional; turn missing values into null for the database.
function toColumns(data: CustomerData) {
  return {
    name: data.name,
    contactName: data.contactName ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    preferredLanguage: data.preferredLanguage ?? null,
    notes: data.notes ?? null,
  };
}

export class DrizzleCustomerRepository implements CustomerRepository {
  async listActive(organizationId: OrganizationId): Promise<Customer[]> {
    const rows = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, organizationId),
          isNull(customers.archivedAt),
        ),
      )
      .orderBy(desc(customers.createdAt));
    return rows.map(toDomain);
  }

  async listArchived(organizationId: OrganizationId): Promise<Customer[]> {
    const rows = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, organizationId),
          isNotNull(customers.archivedAt),
        ),
      )
      .orderBy(desc(customers.archivedAt));
    return rows.map(toDomain);
  }

  async getById(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<Customer | null> {
    const [row] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, organizationId),
          eq(customers.id, customerId),
        ),
      )
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async create(
    organizationId: OrganizationId,
    data: CustomerData,
  ): Promise<Customer> {
    const [row] = await db
      .insert(customers)
      .values({ organizationId, ...toColumns(data) })
      .returning();
    return toDomain(row!);
  }

  async update(
    organizationId: OrganizationId,
    customerId: CustomerId,
    data: CustomerData,
  ): Promise<Customer> {
    const [row] = await db
      .update(customers)
      .set(toColumns(data))
      .where(
        and(
          eq(customers.organizationId, organizationId),
          eq(customers.id, customerId),
        ),
      )
      .returning();
    return toDomain(row!);
  }

  async setArchived(
    organizationId: OrganizationId,
    customerId: CustomerId,
    archived: boolean,
  ): Promise<void> {
    await db
      .update(customers)
      .set({ archivedAt: archived ? new Date() : null })
      .where(
        and(
          eq(customers.organizationId, organizationId),
          eq(customers.id, customerId),
        ),
      );
  }
}
