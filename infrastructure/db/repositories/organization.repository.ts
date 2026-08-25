import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import {
  organizations,
  organizationMembers,
} from "@/infrastructure/db/schema";
import type {
  CreateOrganizationInput,
  Organization,
  OrganizationRepository,
} from "@/domain/organizations/organization.repository";
import type {
  OrganizationId,
  OrganizationRole,
  UserId,
} from "@/domain/shared/types";

function toDomain(row: typeof organizations.$inferSelect): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    defaultCurrency: row.defaultCurrency,
    defaultLanguage: row.defaultLanguage,
    customerDocumentLanguage: row.customerDocumentLanguage,
  };
}

/**
 * Drizzle-backed adapter for the OrganizationRepository port.
 */
export class DrizzleOrganizationRepository implements OrganizationRepository {
  async createWithOwner(
    input: CreateOrganizationInput,
  ): Promise<Organization> {
    return db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: input.name,
          slug: input.slug,
          defaultCurrency: input.defaultCurrency,
          defaultLanguage: input.defaultLanguage,
          customerDocumentLanguage: input.customerDocumentLanguage,
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: org!.id,
        userId: input.ownerUserId,
        role: "owner",
      });

      return toDomain(org!);
    });
  }

  async findByUser(userId: UserId): Promise<Organization[]> {
    const rows = await db
      .select({ org: organizations })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(eq(organizationMembers.userId, userId));

    return rows.map((r) => toDomain(r.org));
  }

  async isSlugTaken(slug: string): Promise<boolean> {
    const [row] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return Boolean(row);
  }

  async getUserRole(
    organizationId: OrganizationId,
    userId: UserId,
  ): Promise<OrganizationRole | null> {
    const [row] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);
    return row?.role ?? null;
  }
}
