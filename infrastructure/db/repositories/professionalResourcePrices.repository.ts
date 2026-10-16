import { and, asc, eq, inArray } from "drizzle-orm";
import type { OrganizationId, SupportedCurrency } from "@/domain/shared/types";
import type {
  CreateResourcePriceData,
  ProfessionalResource,
  ProfessionalResourcePricesRepository,
  ProfessionalResourceWithPrices,
  ResourcePriceCandidateRecord,
  ResourcePriceRecord,
} from "@/domain/professional-estimates/professional-resource-prices.repository";
import { db } from "@/infrastructure/db";
import {
  normativeSources,
  professionalResources,
  resourcePrices,
} from "@/infrastructure/db/schema";

function toPriceRecord(
  row: typeof resourcePrices.$inferSelect,
): ResourcePriceRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    resourceId: row.resourceId,
    sourceId: row.sourceId,
    price: row.price,
    basisQuantity: row.basisQuantity,
    currency: row.currency as SupportedCurrency,
    validFrom: row.validFrom,
    validTo: row.validTo,
    sourceType: row.sourceType as ResourcePriceRecord["sourceType"],
    sourceReference: row.sourceReference,
    location: row.location,
    createdAt: row.createdAt,
  };
}

export class DrizzleProfessionalResourcePricesRepository
  implements ProfessionalResourcePricesRepository
{
  private async loadResources(
    organizationId: OrganizationId,
    resourceId?: string,
  ): Promise<ProfessionalResourceWithPrices[]> {
    const filters = [eq(professionalResources.organizationId, organizationId)];
    if (resourceId) filters.push(eq(professionalResources.id, resourceId));
    const rows = await db
      .select({
        resource: professionalResources,
        source: normativeSources,
      })
      .from(professionalResources)
      .innerJoin(
        normativeSources,
        and(
          eq(normativeSources.id, professionalResources.sourceId),
          eq(normativeSources.organizationId, professionalResources.organizationId),
        ),
      )
      .where(and(...filters))
      .orderBy(professionalResources.code, professionalResources.name);

    if (rows.length === 0) return [];
    const resourceIds = rows.map(({ resource }) => resource.id);
    const prices = await db
      .select()
      .from(resourcePrices)
      .where(
        and(
          eq(resourcePrices.organizationId, organizationId),
          inArray(resourcePrices.resourceId, resourceIds),
        ),
      )
      .orderBy(asc(resourcePrices.validFrom), asc(resourcePrices.createdAt));
    const pricesByResource = new Map<string, ResourcePriceRecord[]>();
    for (const price of prices) {
      const records = pricesByResource.get(price.resourceId) ?? [];
      records.push(toPriceRecord(price));
      pricesByResource.set(price.resourceId, records);
    }

    return rows.map(({ resource, source }) => {
      const mappedResource: ProfessionalResource = {
        id: resource.id,
        organizationId: resource.organizationId,
        code: resource.code,
        name: resource.name,
        resourceType:
          resource.resourceType as ProfessionalResource["resourceType"],
        unit: resource.unit,
        description: resource.description,
        source: {
          type: source.sourceType,
          title: source.title,
          code: source.code,
          officialStatus: source.officialStatus,
        },
      };
      return {
        resource: mappedResource,
        prices: pricesByResource.get(resource.id) ?? [],
      };
    });
  }

  listProfessionalResourcesWithPrices(
    organizationId: OrganizationId,
  ): Promise<ProfessionalResourceWithPrices[]> {
    return this.loadResources(organizationId);
  }

  async getProfessionalResourceWithPrices(
    organizationId: OrganizationId,
    resourceId: string,
  ): Promise<ProfessionalResourceWithPrices | null> {
    const [resource] = await this.loadResources(organizationId, resourceId);
    return resource ?? null;
  }

  async createResourcePrice(
    organizationId: OrganizationId,
    resourceId: string,
    data: CreateResourcePriceData,
  ): Promise<ResourcePriceRecord | null> {
    const [resource] = await db
      .select({ id: professionalResources.id })
      .from(professionalResources)
      .where(
        and(
          eq(professionalResources.organizationId, organizationId),
          eq(professionalResources.id, resourceId),
        ),
      )
      .limit(1);
    if (!resource) return null;

    const [created] = await db
      .insert(resourcePrices)
      .values({
        organizationId,
        resourceId,
        sourceId: null,
        price: data.price,
        basisQuantity: data.basisQuantity,
        currency: data.currency,
        validFrom: data.validFrom,
        validTo: data.validTo ?? null,
        sourceType: data.sourceType,
        sourceReference: data.sourceReference ?? null,
        location: data.location ?? null,
      })
      .returning();
    if (!created) throw new Error("Nu s-a putut salva prețul resursei.");
    return toPriceRecord(created);
  }

  async listPriceCandidates(
    organizationId: OrganizationId,
    resourceIds: string[],
    currency: SupportedCurrency,
  ): Promise<ResourcePriceCandidateRecord[]> {
    if (resourceIds.length === 0) return [];
    const rows = await db
      .select()
      .from(resourcePrices)
      .where(
        and(
          eq(resourcePrices.organizationId, organizationId),
          inArray(resourcePrices.resourceId, resourceIds),
          eq(resourcePrices.currency, currency),
        ),
      )
      .orderBy(asc(resourcePrices.validFrom), asc(resourcePrices.createdAt));
    return rows.map((row) => ({
      ...toPriceRecord(row),
      resourcePriceId: row.id,
      priceBasisQuantity: row.basisQuantity,
    }));
  }
}
