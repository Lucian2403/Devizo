import { and, eq, max } from "drizzle-orm";
import type { OrganizationId, SupportedCurrency } from "@/domain/shared/types";
import type {
  ProfessionalObjectEstimateCostCategory,
} from "@/domain/professional-estimates/calculation";
import type {
  ProfessionalObjectEstimateData,
  ProfessionalObjectEstimateEntryRecord,
  ProfessionalObjectEstimateRecord,
  ProfessionalObjectEstimateRepository,
  ProfessionalObjectEstimateSummaryRecord,
  ProfessionalObjectEstimateWorkspaceRecord,
} from "@/domain/professional-estimates/professional-object-estimate.repository";
import { db } from "@/infrastructure/db";
import {
  constructionObjects,
  professionalObjectEstimateEntries,
  professionalObjectEstimates,
} from "@/infrastructure/db/schema";

export class DuplicateProfessionalObjectEstimateEntryError extends Error {
  constructor() {
    super("Acest deviz local este deja asociat devizului pe obiect.");
    this.name = "DuplicateProfessionalObjectEstimateEntryError";
  }
}

function mapEstimate(
  row: typeof professionalObjectEstimates.$inferSelect,
): ProfessionalObjectEstimateRecord {
  return {
    ...row,
    currency: row.currency as SupportedCurrency,
  };
}

function mapEntry(
  row: typeof professionalObjectEstimateEntries.$inferSelect,
): ProfessionalObjectEstimateEntryRecord {
  return {
    ...row,
    costCategory: row.costCategory as ProfessionalObjectEstimateCostCategory,
  };
}

function isUniqueConstraint(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const postgresError = error as {
    code?: unknown;
    constraint_name?: unknown;
    constraint?: unknown;
  };
  return (
    postgresError.code === "23505" &&
    (postgresError.constraint_name === constraint ||
      postgresError.constraint === constraint)
  );
}

export class DrizzleProfessionalObjectEstimateRepository
  implements ProfessionalObjectEstimateRepository
{
  async list(
    organizationId: OrganizationId,
  ): Promise<ProfessionalObjectEstimateSummaryRecord[]> {
    const rows = await db
      .select({ estimate: professionalObjectEstimates, objectName: constructionObjects.name })
      .from(professionalObjectEstimates)
      .innerJoin(
        constructionObjects,
        and(
          eq(constructionObjects.id, professionalObjectEstimates.constructionObjectId),
          eq(constructionObjects.organizationId, professionalObjectEstimates.organizationId),
        ),
      )
      .where(eq(professionalObjectEstimates.organizationId, organizationId))
      .orderBy(professionalObjectEstimates.valuationDate, professionalObjectEstimates.createdAt);
    return Promise.all(
      rows.map(async ({ estimate, objectName }) => ({
        estimate: mapEstimate(estimate),
        constructionObjectName: objectName,
        entries: await this.listEntries(organizationId, estimate.id),
      })),
    );
  }

  async listConstructionObjects(organizationId: OrganizationId) {
    return db
      .select({
        id: constructionObjects.id,
        name: constructionObjects.name,
        code: constructionObjects.code,
      })
      .from(constructionObjects)
      .where(eq(constructionObjects.organizationId, organizationId))
      .orderBy(constructionObjects.name);
  }

  async constructionObjectExists(
    organizationId: OrganizationId,
    constructionObjectId: string,
  ): Promise<boolean> {
    const [row] = await db
      .select({ id: constructionObjects.id })
      .from(constructionObjects)
      .where(
        and(
          eq(constructionObjects.organizationId, organizationId),
          eq(constructionObjects.id, constructionObjectId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async get(
    organizationId: OrganizationId,
    objectEstimateId: string,
  ): Promise<ProfessionalObjectEstimateWorkspaceRecord | null> {
    const [row] = await db
      .select({ estimate: professionalObjectEstimates, objectName: constructionObjects.name })
      .from(professionalObjectEstimates)
      .innerJoin(
        constructionObjects,
        and(
          eq(constructionObjects.id, professionalObjectEstimates.constructionObjectId),
          eq(constructionObjects.organizationId, professionalObjectEstimates.organizationId),
        ),
      )
      .where(
        and(
          eq(professionalObjectEstimates.organizationId, organizationId),
          eq(professionalObjectEstimates.id, objectEstimateId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      estimate: mapEstimate(row.estimate),
      constructionObjectName: row.objectName,
      entries: await this.listEntries(organizationId, row.estimate.id),
    };
  }

  async create(
    organizationId: OrganizationId,
    data: ProfessionalObjectEstimateData,
  ): Promise<string> {
    const [row] = await db
      .insert(professionalObjectEstimates)
      .values({
        organizationId,
        constructionObjectId: data.constructionObjectId,
        name: data.name,
        code: data.code ?? null,
        valuationDate: data.valuationDate,
        currency: data.currency,
        notes: data.notes ?? null,
      })
      .returning({ id: professionalObjectEstimates.id });
    if (!row) throw new Error("Failed to create professional object estimate.");
    return row.id;
  }

  async addEntry(
    organizationId: OrganizationId,
    objectEstimateId: string,
    calculationContextId: string,
    costCategory: ProfessionalObjectEstimateCostCategory,
  ): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        const [objectEstimate] = await tx
          .select({ id: professionalObjectEstimates.id })
          .from(professionalObjectEstimates)
          .where(
            and(
              eq(professionalObjectEstimates.organizationId, organizationId),
              eq(professionalObjectEstimates.id, objectEstimateId),
            ),
          )
          .for("update");
        if (!objectEstimate) return false;
        const [position] = await tx
          .select({ value: max(professionalObjectEstimateEntries.positionNumber) })
          .from(professionalObjectEstimateEntries)
          .where(
            and(
              eq(professionalObjectEstimateEntries.organizationId, organizationId),
              eq(professionalObjectEstimateEntries.objectEstimateId, objectEstimateId),
            ),
          );
        const [row] = await tx
          .insert(professionalObjectEstimateEntries)
          .values({
            organizationId,
            objectEstimateId,
            calculationContextId,
            positionNumber: (position?.value ?? 0) + 1,
            costCategory,
          })
          .returning({ id: professionalObjectEstimateEntries.id });
        return Boolean(row);
      });
    } catch (error) {
      if (
        isUniqueConstraint(
          error,
          "professional_object_estimate_entries_membership_unique",
        )
      ) {
        throw new DuplicateProfessionalObjectEstimateEntryError();
      }
      throw error;
    }
  }

  async updateEntry(
    organizationId: OrganizationId,
    objectEstimateId: string,
    entryId: string,
    data: {
      included?: boolean;
      costCategory?: ProfessionalObjectEstimateCostCategory;
    },
  ): Promise<boolean> {
    const [row] = await db
      .update(professionalObjectEstimateEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(professionalObjectEstimateEntries.organizationId, organizationId),
          eq(professionalObjectEstimateEntries.objectEstimateId, objectEstimateId),
          eq(professionalObjectEstimateEntries.id, entryId),
        ),
      )
      .returning({ id: professionalObjectEstimateEntries.id });
    return Boolean(row);
  }

  private async listEntries(
    organizationId: OrganizationId,
    objectEstimateId: string,
  ): Promise<ProfessionalObjectEstimateEntryRecord[]> {
    const rows = await db
      .select()
      .from(professionalObjectEstimateEntries)
      .where(
        and(
          eq(professionalObjectEstimateEntries.organizationId, organizationId),
          eq(professionalObjectEstimateEntries.objectEstimateId, objectEstimateId),
        ),
      )
      .orderBy(professionalObjectEstimateEntries.positionNumber);
    return rows.map(mapEntry);
  }
}
