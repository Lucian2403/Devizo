import { and, eq, max } from "drizzle-orm";
import type { OrganizationId, SupportedCurrency } from "@/domain/shared/types";
import type {
  ProfessionalGeneralEstimateData,
  ProfessionalGeneralEstimateEntryRecord,
  ProfessionalGeneralEstimateRecord,
  ProfessionalGeneralEstimateRepository,
  ProfessionalGeneralEstimateSummaryRecord,
} from "@/domain/professional-estimates/professional-general-estimate.repository";
import { db } from "@/infrastructure/db";
import {
  professionalGeneralEstimateEntries,
  professionalGeneralEstimates,
} from "@/infrastructure/db/schema";

export class DuplicateProfessionalGeneralEstimateEntryError extends Error {
  constructor() {
    super("Acest deviz pe obiect este deja asociat devizului general.");
    this.name = "DuplicateProfessionalGeneralEstimateEntryError";
  }
}

function mapEstimate(
  row: typeof professionalGeneralEstimates.$inferSelect,
): ProfessionalGeneralEstimateRecord {
  return { ...row, currency: row.currency as SupportedCurrency };
}

function mapEntry(
  row: typeof professionalGeneralEstimateEntries.$inferSelect,
): ProfessionalGeneralEstimateEntryRecord {
  return row;
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

export class DrizzleProfessionalGeneralEstimateRepository
  implements ProfessionalGeneralEstimateRepository
{
  async list(
    organizationId: OrganizationId,
  ): Promise<ProfessionalGeneralEstimateSummaryRecord[]> {
    const rows = await db
      .select()
      .from(professionalGeneralEstimates)
      .where(eq(professionalGeneralEstimates.organizationId, organizationId))
      .orderBy(
        professionalGeneralEstimates.valuationDate,
        professionalGeneralEstimates.createdAt,
      );
    return Promise.all(
      rows.map(async (estimate) => ({
        estimate: mapEstimate(estimate),
        entries: await this.listEntries(organizationId, estimate.id),
      })),
    );
  }

  async get(
    organizationId: OrganizationId,
    generalEstimateId: string,
  ): Promise<ProfessionalGeneralEstimateSummaryRecord | null> {
    const [row] = await db
      .select()
      .from(professionalGeneralEstimates)
      .where(
        and(
          eq(professionalGeneralEstimates.organizationId, organizationId),
          eq(professionalGeneralEstimates.id, generalEstimateId),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      estimate: mapEstimate(row),
      entries: await this.listEntries(organizationId, generalEstimateId),
    };
  }

  async create(
    organizationId: OrganizationId,
    data: ProfessionalGeneralEstimateData,
  ): Promise<string> {
    const [row] = await db
      .insert(professionalGeneralEstimates)
      .values({
        organizationId,
        name: data.name,
        code: data.code ?? null,
        valuationDate: data.valuationDate,
        currency: data.currency,
        notes: data.notes ?? null,
      })
      .returning({ id: professionalGeneralEstimates.id });
    if (!row) throw new Error("Failed to create professional general estimate.");
    return row.id;
  }

  async addEntry(
    organizationId: OrganizationId,
    generalEstimateId: string,
    objectEstimateId: string,
    chapterNumber: number,
  ): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        const [generalEstimate] = await tx
          .select({ id: professionalGeneralEstimates.id })
          .from(professionalGeneralEstimates)
          .where(
            and(
              eq(professionalGeneralEstimates.organizationId, organizationId),
              eq(professionalGeneralEstimates.id, generalEstimateId),
            ),
          )
          .for("update");
        if (!generalEstimate) return false;
        const [position] = await tx
          .select({
            value: max(
              professionalGeneralEstimateEntries.chapterPositionNumber,
            ),
          })
          .from(professionalGeneralEstimateEntries)
          .where(
            and(
              eq(
                professionalGeneralEstimateEntries.organizationId,
                organizationId,
              ),
              eq(
                professionalGeneralEstimateEntries.generalEstimateId,
                generalEstimateId,
              ),
              eq(
                professionalGeneralEstimateEntries.chapterNumber,
                chapterNumber,
              ),
            ),
          );
        const [row] = await tx
          .insert(professionalGeneralEstimateEntries)
          .values({
            organizationId,
            generalEstimateId,
            objectEstimateId,
            chapterNumber,
            chapterPositionNumber: (position?.value ?? 0) + 1,
          })
          .returning({ id: professionalGeneralEstimateEntries.id });
        return Boolean(row);
      });
    } catch (error) {
      if (
        isUniqueConstraint(
          error,
          "professional_general_estimate_entries_membership_unique",
        )
      ) {
        throw new DuplicateProfessionalGeneralEstimateEntryError();
      }
      throw error;
    }
  }

  async updateEntry(
    organizationId: OrganizationId,
    generalEstimateId: string,
    entryId: string,
    data: { included?: boolean; chapterNumber?: number },
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [estimate] = await tx
        .select({ id: professionalGeneralEstimates.id })
        .from(professionalGeneralEstimates)
        .where(
          and(
            eq(professionalGeneralEstimates.organizationId, organizationId),
            eq(professionalGeneralEstimates.id, generalEstimateId),
          ),
        )
        .for("update");
      if (!estimate) return false;
      const [entry] = await tx
        .select({
          id: professionalGeneralEstimateEntries.id,
          chapterNumber: professionalGeneralEstimateEntries.chapterNumber,
        })
        .from(professionalGeneralEstimateEntries)
        .where(
          and(
            eq(
              professionalGeneralEstimateEntries.organizationId,
              organizationId,
            ),
            eq(
              professionalGeneralEstimateEntries.generalEstimateId,
              generalEstimateId,
            ),
            eq(professionalGeneralEstimateEntries.id, entryId),
          ),
        )
        .for("update");
      if (!entry) return false;

      let chapterPositionNumber: number | undefined;
      if (
        data.chapterNumber !== undefined &&
        data.chapterNumber !== entry.chapterNumber
      ) {
        const [position] = await tx
          .select({
            value: max(
              professionalGeneralEstimateEntries.chapterPositionNumber,
            ),
          })
          .from(professionalGeneralEstimateEntries)
          .where(
            and(
              eq(
                professionalGeneralEstimateEntries.organizationId,
                organizationId,
              ),
              eq(
                professionalGeneralEstimateEntries.generalEstimateId,
                generalEstimateId,
              ),
              eq(
                professionalGeneralEstimateEntries.chapterNumber,
                data.chapterNumber,
              ),
            ),
          );
        chapterPositionNumber = (position?.value ?? 0) + 1;
      }
      const [updated] = await tx
        .update(professionalGeneralEstimateEntries)
        .set({
          ...data,
          ...(chapterPositionNumber === undefined
            ? {}
            : { chapterPositionNumber }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              professionalGeneralEstimateEntries.organizationId,
              organizationId,
            ),
            eq(
              professionalGeneralEstimateEntries.generalEstimateId,
              generalEstimateId,
            ),
            eq(professionalGeneralEstimateEntries.id, entryId),
          ),
        )
        .returning({ id: professionalGeneralEstimateEntries.id });
      return Boolean(updated);
    });
  }

  private async listEntries(
    organizationId: OrganizationId,
    generalEstimateId: string,
  ): Promise<ProfessionalGeneralEstimateEntryRecord[]> {
    const rows = await db
      .select()
      .from(professionalGeneralEstimateEntries)
      .where(
        and(
          eq(professionalGeneralEstimateEntries.organizationId, organizationId),
          eq(
            professionalGeneralEstimateEntries.generalEstimateId,
            generalEstimateId,
          ),
        ),
      )
      .orderBy(
        professionalGeneralEstimateEntries.chapterNumber,
        professionalGeneralEstimateEntries.chapterPositionNumber,
      );
    return rows.map(mapEntry);
  }
}
