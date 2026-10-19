import type { OrganizationId, SupportedCurrency } from "@/domain/shared/types";
import type { ProfessionalResourceType } from "./types";

export const RESOURCE_PRICE_SOURCE_TYPES = [
  "manual",
  "supplier",
  "invoice",
  "market",
  "import",
] as const;
export type ResourcePriceSourceType =
  (typeof RESOURCE_PRICE_SOURCE_TYPES)[number];

export interface ProfessionalResourceSource {
  type: string;
  title: string;
  code: string;
  officialStatus: string;
}

export interface ProfessionalResource {
  id: string;
  organizationId: OrganizationId;
  code: string | null;
  name: string;
  resourceType: ProfessionalResourceType;
  unit: string;
  description: string | null;
  source: ProfessionalResourceSource;
}

export interface ResourcePriceRecord {
  id: string;
  organizationId: OrganizationId;
  resourceId: string;
  sourceId: string | null;
  price: string;
  basisQuantity: string;
  currency: SupportedCurrency;
  validFrom: string;
  validTo: string | null;
  sourceType: ResourcePriceSourceType;
  sourceReference: string | null;
  location: string | null;
  createdAt: Date;
}

export interface ResourcePriceCandidateRecord extends ResourcePriceRecord {
  resourcePriceId: string;
  priceBasisQuantity: string;
}

export interface ProfessionalResourceWithPrices {
  resource: ProfessionalResource;
  prices: ResourcePriceRecord[];
}

export interface CreateResourcePriceData {
  price: string;
  basisQuantity: string;
  currency: SupportedCurrency;
  validFrom: string;
  validTo?: string;
  sourceType: ResourcePriceSourceType;
  sourceReference?: string;
  location?: string;
}

export interface ProfessionalResourcePricesRepository {
  listProfessionalResourcesWithPrices(
    organizationId: OrganizationId,
  ): Promise<ProfessionalResourceWithPrices[]>;
  getProfessionalResourceWithPrices(
    organizationId: OrganizationId,
    resourceId: string,
  ): Promise<ProfessionalResourceWithPrices | null>;
  createResourcePrice(
    organizationId: OrganizationId,
    resourceId: string,
    data: CreateResourcePriceData,
  ): Promise<ResourcePriceRecord | null>;
  listPriceCandidates(
    organizationId: OrganizationId,
    resourceIds: string[],
    currency: SupportedCurrency,
  ): Promise<ResourcePriceCandidateRecord[]>;
}
