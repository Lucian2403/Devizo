import type { OrganizationId, OrganizationRole, UserId } from "@/domain/shared/types";

export interface Organization {
  id: OrganizationId;
  name: string;
  slug: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  vatNumber: string | null;
  vatRate: string | null;
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

// Company profile fields the settings page can update.
export interface CompanySettingsInput {
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  vatNumber?: string;
  vatRate?: number;
  defaultCurrency: string;
  defaultLanguage: string;
  customerDocumentLanguage: string;
}

/**
 * Port owned by the domain. Infrastructure provides the implementation so the
 * business logic never depends on Drizzle or Supabase directly.
 */
export interface OrganizationRepository {
  /** Creates the organization and its owner membership atomically. */
  createWithOwner(input: CreateOrganizationInput): Promise<Organization>;
  findByUser(userId: UserId): Promise<Organization[]>;
  getById(organizationId: OrganizationId): Promise<Organization | null>;
  updateSettings(
    organizationId: OrganizationId,
    input: CompanySettingsInput,
  ): Promise<Organization>;
  isSlugTaken(slug: string): Promise<boolean>;
  getUserRole(
    organizationId: OrganizationId,
    userId: UserId,
  ): Promise<OrganizationRole | null>;
}
