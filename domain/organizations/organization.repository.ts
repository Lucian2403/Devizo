import type { OrganizationId, OrganizationRole, UserId } from "@/domain/shared/types";

export interface Organization {
  id: OrganizationId;
  name: string;
  slug: string;
  defaultCurrency: string;
  defaultLanguage: string;
  customerDocumentLanguage: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  defaultCurrency: string;
  defaultLanguage: string;
  customerDocumentLanguage: string;
  ownerUserId: UserId;
}

/**
 * Port owned by the domain. Infrastructure provides the implementation so the
 * business logic never depends on Drizzle or Supabase directly.
 */
export interface OrganizationRepository {
  /** Creates the organization and its owner membership atomically. */
  createWithOwner(input: CreateOrganizationInput): Promise<Organization>;
  findByUser(userId: UserId): Promise<Organization[]>;
  isSlugTaken(slug: string): Promise<boolean>;
  getUserRole(
    organizationId: OrganizationId,
    userId: UserId,
  ): Promise<OrganizationRole | null>;
}
