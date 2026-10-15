import { and, desc, eq, inArray } from "drizzle-orm";
import type { OrganizationId } from "@/domain/shared/types";
import {
  DuplicateInternalNormError,
  DuplicateNormResourceError,
  InternalNormSourceConflictError,
  NormAssignmentValidationError,
  NormLibraryRecordNotFoundError,
  type AppliedNorm,
  type CreateInternalNormData,
  type InternalNormResourceData,
  type NormResourceConsumption,
  type NormVersionDetail,
  type NormVersionSummary,
  type NormWorkspace,
  type ProfessionalNormLibraryRepository,
} from "@/domain/professional-estimates/professional-norm-library.repository";
import { db } from "@/infrastructure/db";
import {
  calculationContexts,
  estimateNorms,
  estimateNormVersions,
  normApplications,
  normativeSources,
  professionalResources,
  resourceConsumptions,
  workQuantityItems,
} from "@/infrastructure/db/schema";

const COMPANY_SOURCE = {
  code: "DEVIZO-COMPANY-NORMS",
  edition: "1",
  title: "Norme interne ale companiei",
} as const;

function isUniqueConstraintConflict(error: unknown, constraints: string[]): boolean {
  if (typeof error !== "object" || error === null) return false;
  const postgresError = error as {
    code?: unknown;
    constraint_name?: unknown;
    constraint?: unknown;
  };
  return (
    postgresError.code === "23505" &&
    constraints.includes(
      String(postgresError.constraint_name ?? postgresError.constraint ?? ""),
    )
  );
}

function assertCompanySource(source: typeof normativeSources.$inferSelect): void {
  if (
    source.code !== COMPANY_SOURCE.code ||
    source.edition !== COMPANY_SOURCE.edition ||
    source.title !== COMPANY_SOURCE.title ||
    source.sourceType !== "company_custom" ||
    source.jurisdiction !== "MD" ||
    source.officialStatus !== "unknown" ||
    source.status !== "active" ||
    source.monitoringEnabled
  ) {
    throw new InternalNormSourceConflictError();
  }
}

export class DrizzleProfessionalNormLibraryRepository
  implements ProfessionalNormLibraryRepository
{
  private async loadNormDetails(
    organizationId: OrganizationId,
    versionIds?: string[],
  ): Promise<NormVersionDetail[]> {
    if (versionIds && versionIds.length === 0) return [];
    const conditions = [eq(estimateNormVersions.organizationId, organizationId)];
    if (versionIds) conditions.push(inArray(estimateNormVersions.id, versionIds));

    const rows = await db
      .select({
        version: estimateNormVersions,
        norm: estimateNorms,
        source: normativeSources,
      })
      .from(estimateNormVersions)
      .innerJoin(
        estimateNorms,
        and(
          eq(estimateNorms.id, estimateNormVersions.estimateNormId),
          eq(estimateNorms.organizationId, estimateNormVersions.organizationId),
        ),
      )
      .innerJoin(
        normativeSources,
        and(
          eq(normativeSources.id, estimateNormVersions.sourceId),
          eq(normativeSources.organizationId, estimateNormVersions.organizationId),
        ),
      )
      .where(and(...conditions))
      .orderBy(estimateNorms.code, estimateNormVersions.versionLabel);
    if (rows.length === 0) return [];

    const consumptions = await db
      .select({
        consumption: resourceConsumptions,
        resource: professionalResources,
      })
      .from(resourceConsumptions)
      .innerJoin(
        professionalResources,
        and(
          eq(professionalResources.id, resourceConsumptions.resourceId),
          eq(professionalResources.organizationId, resourceConsumptions.organizationId),
        ),
      )
      .where(
        and(
          eq(resourceConsumptions.organizationId, organizationId),
          inArray(
            resourceConsumptions.estimateNormVersionId,
            rows.map(({ version }) => version.id),
          ),
        ),
      )
      .orderBy(resourceConsumptions.estimateNormVersionId, resourceConsumptions.positionNumber);

    const resourcesByVersion = new Map<string, NormResourceConsumption[]>();
    for (const { consumption, resource } of consumptions) {
      const resources = resourcesByVersion.get(consumption.estimateNormVersionId) ?? [];
      resources.push({
        id: consumption.id,
        positionNumber: consumption.positionNumber,
        resourceId: resource.id,
        code: resource.code,
        name: resource.name,
        resourceType: resource.resourceType as NormResourceConsumption["resourceType"],
        unit: resource.unit,
        quantityPerNormBasis: consumption.quantityPerNormBasis,
      });
      resourcesByVersion.set(consumption.estimateNormVersionId, resources);
    }

    return rows.map(({ version, norm, source }) => {
      const resources = resourcesByVersion.get(version.id) ?? [];
      return {
        norm: {
          id: version.id,
          estimateNormId: norm.id,
          code: norm.code,
          name: norm.name,
          category: norm.category,
          description: version.description ?? norm.description,
          versionLabel: version.versionLabel,
          basisQuantity: version.basisQuantity,
          basisUnit: version.basisUnit,
          method: version.method,
          sourceType: source.sourceType,
          sourceTitle: source.title,
          sourceCode: source.code,
          officialStatus: source.officialStatus,
          validFrom: version.validFrom,
          validTo: version.validTo,
          publicationStatus: version.publicationStatus,
          resourceCount: resources.length,
        },
        resources,
      };
    });
  }

  async listNormVersions(
    organizationId: OrganizationId,
  ): Promise<NormVersionSummary[]> {
    const details = await this.loadNormDetails(organizationId);
    return details.map(({ norm }) => norm);
  }

  async getNormVersion(
    organizationId: OrganizationId,
    estimateNormVersionId: string,
  ): Promise<NormVersionDetail | null> {
    const [detail] = await this.loadNormDetails(organizationId, [
      estimateNormVersionId,
    ]);
    return detail ?? null;
  }

  async createInternalNorm(
    organizationId: OrganizationId,
    data: CreateInternalNormData,
  ): Promise<string> {
    try {
      return await db.transaction(async (tx) => {
        let [source] = await tx
          .select()
          .from(normativeSources)
          .where(
            and(
              eq(normativeSources.organizationId, organizationId),
              eq(normativeSources.code, COMPANY_SOURCE.code),
              eq(normativeSources.edition, COMPANY_SOURCE.edition),
            ),
          )
          .limit(1);

        if (!source) {
          [source] = await tx
            .insert(normativeSources)
            .values({
              organizationId,
              ...COMPANY_SOURCE,
              sourceType: "company_custom",
              jurisdiction: "MD",
              status: "active",
              officialStatus: "unknown",
              monitoringEnabled: false,
              lastVerificationStatus: "never",
            })
            .onConflictDoNothing({
              target: [
                normativeSources.organizationId,
                normativeSources.code,
                normativeSources.edition,
              ],
            })
            .returning();
        }

        if (!source) {
          [source] = await tx
            .select()
            .from(normativeSources)
            .where(
              and(
                eq(normativeSources.organizationId, organizationId),
                eq(normativeSources.code, COMPANY_SOURCE.code),
                eq(normativeSources.edition, COMPANY_SOURCE.edition),
              ),
            )
            .limit(1);
        }
        if (!source) throw new Error("Nu s-a putut pregăti sursa normelor interne.");
        assertCompanySource(source);

        const [norm] = await tx
          .insert(estimateNorms)
          .values({
            organizationId,
            namespace: "company_custom",
            code: data.code,
            name: data.name,
            category: data.category ?? null,
            description: data.description ?? null,
          })
          .returning({ id: estimateNorms.id });
        if (!norm) throw new Error("Nu s-a putut crea norma internă.");

        const [version] = await tx
          .insert(estimateNormVersions)
          .values({
            organizationId,
            estimateNormId: norm.id,
            sourceId: source.id,
            versionLabel: data.versionLabel,
            method: "resource",
            basisQuantity: data.basisQuantity,
            basisUnit: data.basisUnit,
            description: data.description ?? null,
            validFrom: data.validFrom ?? null,
            validTo: data.validTo ?? null,
            publicationStatus: "published",
          })
          .returning({ id: estimateNormVersions.id });
        if (!version) throw new Error("Nu s-a putut crea versiunea normei.");
        return version.id;
      });
    } catch (error) {
      if (
        isUniqueConstraintConflict(error, [
          "estimate_norms_org_namespace_code_unique",
          "estimate_norm_versions_norm_version_unique",
        ])
      ) {
        throw new DuplicateInternalNormError();
      }
      throw error;
    }
  }

  async addInternalNormResource(
    organizationId: OrganizationId,
    estimateNormVersionId: string,
    data: InternalNormResourceData,
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const [normRow] = await tx
          .select({
            version: estimateNormVersions,
            source: normativeSources,
          })
          .from(estimateNormVersions)
          .innerJoin(
            normativeSources,
            and(
              eq(normativeSources.id, estimateNormVersions.sourceId),
              eq(normativeSources.organizationId, estimateNormVersions.organizationId),
            ),
          )
          .where(
            and(
              eq(estimateNormVersions.organizationId, organizationId),
              eq(estimateNormVersions.id, estimateNormVersionId),
            ),
          )
          .limit(1);
        if (!normRow) throw new NormLibraryRecordNotFoundError();
        assertCompanySource(normRow.source);

        let resource: typeof professionalResources.$inferSelect | undefined;
        if (data.code) {
          [resource] = await tx
            .select()
            .from(professionalResources)
            .where(
              and(
                eq(professionalResources.organizationId, organizationId),
                eq(professionalResources.sourceId, normRow.source.id),
                eq(professionalResources.code, data.code),
              ),
            )
            .limit(1);
          if (
            resource &&
            (resource.name !== data.name ||
              resource.resourceType !== data.resourceType ||
              resource.unit !== data.unit)
          ) {
            throw new DuplicateNormResourceError();
          }
        }

        if (!resource) {
          [resource] = await tx
            .insert(professionalResources)
            .values({
              organizationId,
              sourceId: normRow.source.id,
              code: data.code ?? null,
              name: data.name,
              resourceType: data.resourceType,
              unit: data.unit,
            })
            .returning();
        }
        if (!resource) throw new Error("Nu s-a putut crea resursa profesională.");

        const [lastConsumption] = await tx
          .select({ positionNumber: resourceConsumptions.positionNumber })
          .from(resourceConsumptions)
          .where(
            and(
              eq(resourceConsumptions.organizationId, organizationId),
              eq(resourceConsumptions.estimateNormVersionId, estimateNormVersionId),
            ),
          )
          .orderBy(desc(resourceConsumptions.positionNumber))
          .limit(1);
        await tx.insert(resourceConsumptions).values({
          organizationId,
          estimateNormVersionId,
          resourceId: resource.id,
          positionNumber: (lastConsumption?.positionNumber ?? 0) + 1,
          quantityPerNormBasis: data.quantityPerNormBasis,
        });
      });
    } catch (error) {
      if (
        isUniqueConstraintConflict(error, [
          "professional_resources_org_source_code_unique",
        ])
      ) {
        throw new DuplicateNormResourceError();
      }
      if (
        isUniqueConstraintConflict(error, [
          "resource_consumptions_norm_position_unique",
        ])
      ) {
        throw new NormAssignmentValidationError(
          "Resursa nu a putut fi adăugată din cauza unei modificări simultane. Reîncercați.",
        );
      }
      throw error;
    }
  }

  async getNormWorkspace(
    organizationId: OrganizationId,
    calculationContextId: string,
  ): Promise<NormWorkspace | null> {
    const [context] = await db
      .select({
        id: calculationContexts.id,
        workQuantityListId: calculationContexts.workQuantityListId,
        valuationDate: calculationContexts.valuationDate,
      })
      .from(calculationContexts)
      .where(
        and(
          eq(calculationContexts.organizationId, organizationId),
          eq(calculationContexts.id, calculationContextId),
        ),
      )
      .limit(1);
    if (!context) return null;

    const items = await db
      .select({
        id: workQuantityItems.id,
        unit: workQuantityItems.unit,
        quantity: workQuantityItems.quantity,
      })
      .from(workQuantityItems)
      .where(
        and(
          eq(workQuantityItems.organizationId, organizationId),
          eq(workQuantityItems.workQuantityListId, context.workQuantityListId),
        ),
      );
    const applicationRows = items.length
      ? await db
          .select()
          .from(normApplications)
          .where(
            and(
              eq(normApplications.organizationId, organizationId),
              eq(normApplications.calculationContextId, context.id),
              inArray(
                normApplications.workQuantityItemId,
                items.map(({ id }) => id),
              ),
            ),
          )
      : [];
    const details = await this.loadNormDetails(organizationId);
    const detailById = new Map(details.map((detail) => [detail.norm.id, detail]));
    const applicationByItem = new Map<string, AppliedNorm>();
    for (const application of applicationRows) {
      const norm = detailById.get(application.estimateNormVersionId);
      if (!norm) continue;
      applicationByItem.set(application.workQuantityItemId, {
        id: application.id,
        estimateNormVersionId: application.estimateNormVersionId,
        applicationOrder: application.applicationOrder,
        applicationCoefficient: application.applicationCoefficient,
        norm,
      });
    }

    return {
      valuationDate: context.valuationDate,
      items: items.map((item) => ({
        ...item,
        application: applicationByItem.get(item.id) ?? null,
      })),
      normVersions: details,
    };
  }

  async getWorkItemNormAssignmentStatus(
    organizationId: OrganizationId,
    calculationContextId: string,
    workQuantityItemId: string,
  ): Promise<{ unit: string; hasNormApplication: boolean } | null> {
    const [row] = await db
      .select({
        unit: workQuantityItems.unit,
        applicationId: normApplications.id,
      })
      .from(calculationContexts)
      .innerJoin(
        workQuantityItems,
        and(
          eq(workQuantityItems.workQuantityListId, calculationContexts.workQuantityListId),
          eq(workQuantityItems.organizationId, calculationContexts.organizationId),
        ),
      )
      .leftJoin(
        normApplications,
        and(
          eq(normApplications.calculationContextId, calculationContexts.id),
          eq(normApplications.workQuantityItemId, workQuantityItems.id),
          eq(normApplications.organizationId, calculationContexts.organizationId),
        ),
      )
      .where(
        and(
          eq(calculationContexts.organizationId, organizationId),
          eq(calculationContexts.id, calculationContextId),
          eq(workQuantityItems.id, workQuantityItemId),
        ),
      )
      .limit(1);
    return row
      ? { unit: row.unit, hasNormApplication: row.applicationId !== null }
      : null;
  }

  async createNormApplication(
    organizationId: OrganizationId,
    calculationContextId: string,
    workQuantityItemId: string,
    estimateNormVersionId: string,
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const [context] = await tx
          .select()
          .from(calculationContexts)
          .where(
            and(
              eq(calculationContexts.organizationId, organizationId),
              eq(calculationContexts.id, calculationContextId),
            ),
          )
          .limit(1);
        if (!context) {
          throw new NormAssignmentValidationError(
            "Devizul profesional nu a fost găsit.",
          );
        }
        const [item] = await tx
          .select()
          .from(workQuantityItems)
          .where(
            and(
              eq(workQuantityItems.organizationId, organizationId),
              eq(workQuantityItems.workQuantityListId, context.workQuantityListId),
              eq(workQuantityItems.id, workQuantityItemId),
            ),
          )
          .limit(1);
        if (!item) {
          throw new NormAssignmentValidationError(
            "Poziția nu aparține listei de cantități a devizului.",
          );
        }

        const [normRow] = await tx
          .select({
            version: estimateNormVersions,
            norm: estimateNorms,
            source: normativeSources,
          })
          .from(estimateNormVersions)
          .innerJoin(
            estimateNorms,
            and(
              eq(estimateNorms.id, estimateNormVersions.estimateNormId),
              eq(estimateNorms.organizationId, estimateNormVersions.organizationId),
            ),
          )
          .innerJoin(
            normativeSources,
            and(
              eq(normativeSources.id, estimateNormVersions.sourceId),
              eq(normativeSources.organizationId, estimateNormVersions.organizationId),
            ),
          )
          .where(
            and(
              eq(estimateNormVersions.organizationId, organizationId),
              eq(estimateNormVersions.id, estimateNormVersionId),
            ),
          )
          .limit(1);
        if (!normRow) {
          throw new NormAssignmentValidationError("Norma selectată nu a fost găsită.");
        }
        if (normRow.version.method !== "resource") {
          throw new NormAssignmentValidationError(
            "Norma selectată nu folosește metoda de resurse.",
          );
        }
        if (normRow.version.publicationStatus !== "published") {
          throw new NormAssignmentValidationError(
            "Norma selectată nu este publicată și eligibilă pentru alocare.",
          );
        }
        if (normRow.version.basisUnit !== item.unit) {
          throw new NormAssignmentValidationError(
            `Unitatea normei (${normRow.version.basisUnit}) nu corespunde cu unitatea poziției (${item.unit}).`,
          );
        }
        if (
          (normRow.version.validFrom && context.valuationDate < normRow.version.validFrom) ||
          (normRow.version.validTo && context.valuationDate > normRow.version.validTo)
        ) {
          throw new NormAssignmentValidationError(
            "Norma nu este valabilă la data evaluării devizului.",
          );
        }

        const [existing] = await tx
          .select({ id: normApplications.id })
          .from(normApplications)
          .where(
            and(
              eq(normApplications.organizationId, organizationId),
              eq(normApplications.calculationContextId, calculationContextId),
              eq(normApplications.workQuantityItemId, workQuantityItemId),
            ),
          )
          .limit(1);
        if (existing) {
          throw new NormAssignmentValidationError(
            "Poziția are deja o normă alocată.",
          );
        }

        await tx.insert(normApplications).values({
          organizationId,
          calculationContextId,
          workQuantityListId: context.workQuantityListId,
          workQuantityItemId,
          estimateNormVersionId,
          applicationOrder: 1,
          applicationCoefficient: "1",
        });
      });
    } catch (error) {
      if (
        isUniqueConstraintConflict(error, [
          "norm_applications_context_item_order_unique",
        ])
      ) {
        throw new NormAssignmentValidationError(
          "Poziția are deja o normă alocată.",
        );
      }
      throw error;
    }
  }
}
