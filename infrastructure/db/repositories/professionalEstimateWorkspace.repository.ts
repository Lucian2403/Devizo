import { and, count, eq } from "drizzle-orm";
import type { OrganizationId } from "@/domain/shared/types";
import type {
  ProfessionalEstimateSummary,
  ProfessionalEstimateWorkspace,
  ProfessionalEstimateWorkspaceRepository,
  ValidatedProfessionalEstimateData,
  WorkQuantityItem,
  WorkQuantityItemData,
  WorkQuantityItemUpdate,
} from "@/domain/professional-estimates/professional-estimate-workspace.repository";
import {
  DuplicateConstructionObjectCodeError,
  DuplicateWorkPositionError,
} from "@/domain/professional-estimates/professional-estimate-workspace.repository";
import { db } from "@/infrastructure/db";
import {
  calculationContexts,
  constructionObjects,
  workQuantityItems,
  workQuantityLists,
} from "@/infrastructure/db/schema";

function toWorkQuantityItem(
  row: typeof workQuantityItems.$inferSelect,
): WorkQuantityItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workQuantityListId: row.workQuantityListId,
    positionNumber: row.positionNumber,
    code: row.code,
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    notes: row.notes,
  };
}

function isUniqueConstraintConflict(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const postgresError = error as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
  return (
    postgresError.code === "23505" &&
    (postgresError.constraint_name === constraint ||
      postgresError.constraint === constraint)
  );
}

export class DrizzleProfessionalEstimateWorkspaceRepository
  implements ProfessionalEstimateWorkspaceRepository
{
  async listProfessionalEstimates(
    organizationId: OrganizationId,
  ): Promise<ProfessionalEstimateSummary[]> {
    const rows = await db
      .select({
        context: calculationContexts,
        object: constructionObjects,
        list: workQuantityLists,
      })
      .from(calculationContexts)
      .innerJoin(
        constructionObjects,
        and(
          eq(constructionObjects.id, calculationContexts.constructionObjectId),
          eq(constructionObjects.organizationId, calculationContexts.organizationId),
        ),
      )
      .innerJoin(
        workQuantityLists,
        and(
          eq(workQuantityLists.id, calculationContexts.workQuantityListId),
          eq(workQuantityLists.constructionObjectId, constructionObjects.id),
          eq(workQuantityLists.organizationId, calculationContexts.organizationId),
        ),
      )
      .where(eq(calculationContexts.organizationId, organizationId))
      .orderBy(calculationContexts.valuationDate, calculationContexts.createdAt);
    if (!rows.length) return [];

    const counts = await db
      .select({
        workQuantityListId: workQuantityItems.workQuantityListId,
        itemCount: count(),
      })
      .from(workQuantityItems)
      .where(eq(workQuantityItems.organizationId, organizationId))
      .groupBy(workQuantityItems.workQuantityListId);
    const countByList = new Map(
      counts.map((row) => [row.workQuantityListId, row.itemCount]),
    );

    return rows.map(({ context, object, list }) => ({
      context: {
        id: context.id,
        organizationId: context.organizationId,
        name: context.name,
        valuationDate: context.valuationDate,
        currency: context.currency as ProfessionalEstimateSummary["context"]["currency"],
        method: "resource",
      },
      constructionObject: {
        id: object.id,
        name: object.name,
        code: object.code,
        address: object.address,
        description: object.description,
      },
      workQuantityList: {
        id: list.id,
        name: list.name,
        revision: list.revision,
        sourceReference: list.sourceReference,
        sourceDate: list.sourceDate,
        description: list.description,
      },
      itemCount: countByList.get(list.id) ?? 0,
    }));
  }

  async getProfessionalEstimate(
    organizationId: OrganizationId,
    calculationContextId: string,
  ): Promise<ProfessionalEstimateWorkspace | null> {
    const [row] = await db
      .select({
        context: calculationContexts,
        object: constructionObjects,
        list: workQuantityLists,
      })
      .from(calculationContexts)
      .innerJoin(
        constructionObjects,
        and(
          eq(constructionObjects.id, calculationContexts.constructionObjectId),
          eq(constructionObjects.organizationId, calculationContexts.organizationId),
        ),
      )
      .innerJoin(
        workQuantityLists,
        and(
          eq(workQuantityLists.id, calculationContexts.workQuantityListId),
          eq(workQuantityLists.constructionObjectId, constructionObjects.id),
          eq(workQuantityLists.organizationId, calculationContexts.organizationId),
        ),
      )
      .where(
        and(
          eq(calculationContexts.organizationId, organizationId),
          eq(calculationContexts.id, calculationContextId),
        ),
      )
      .limit(1);
    if (!row) return null;

    const items = await db
      .select()
      .from(workQuantityItems)
      .where(
        and(
          eq(workQuantityItems.organizationId, organizationId),
          eq(workQuantityItems.workQuantityListId, row.list.id),
        ),
      )
      .orderBy(workQuantityItems.positionNumber);

    return {
      context: {
        id: row.context.id,
        organizationId: row.context.organizationId,
        name: row.context.name,
        valuationDate: row.context.valuationDate,
        currency: row.context.currency as ProfessionalEstimateWorkspace["context"]["currency"],
        method: "resource",
      },
      constructionObject: {
        id: row.object.id,
        name: row.object.name,
        code: row.object.code,
        address: row.object.address,
        description: row.object.description,
      },
      workQuantityList: {
        id: row.list.id,
        name: row.list.name,
        revision: row.list.revision,
        sourceReference: row.list.sourceReference,
        sourceDate: row.list.sourceDate,
        description: row.list.description,
      },
      items: items.map(toWorkQuantityItem),
    };
  }

  async createProfessionalEstimate(
    organizationId: OrganizationId,
    data: ValidatedProfessionalEstimateData,
  ): Promise<string> {
    try {
      return await db.transaction(async (tx) => {
        const [object] = await tx
          .insert(constructionObjects)
          .values({
            organizationId,
            code: data.objectCode ?? null,
            name: data.objectName,
            address: data.objectAddress ?? null,
            description: data.objectDescription ?? null,
          })
          .returning();
        if (!object) throw new Error("Failed to create professional construction object.");

        const [list] = await tx
          .insert(workQuantityLists)
          .values({
            organizationId,
            constructionObjectId: object.id,
            name: data.listName,
            revision: 1,
            sourceReference: data.sourceReference ?? null,
            sourceDate: data.sourceDate ?? null,
          })
          .returning();
        if (!list) throw new Error("Failed to create professional work quantity list.");

        const [context] = await tx
          .insert(calculationContexts)
          .values({
            organizationId,
            constructionObjectId: object.id,
            workQuantityListId: list.id,
            name: data.name,
            valuationDate: data.valuationDate,
            currency: data.currency,
            method: "resource",
          })
          .returning({ id: calculationContexts.id });
        if (!context) throw new Error("Failed to create professional calculation context.");
        return context.id;
      });
    } catch (error) {
      if (
        data.objectCode !== undefined &&
        isUniqueConstraintConflict(error, "construction_objects_org_code_unique")
      ) {
        throw new DuplicateConstructionObjectCodeError(data.objectCode);
      }
      throw error;
    }
  }

  async createWorkQuantityItem(
    organizationId: OrganizationId,
    calculationContextId: string,
    data: WorkQuantityItemData,
  ): Promise<WorkQuantityItem | null> {
    const workspace = await this.getProfessionalEstimate(
      organizationId,
      calculationContextId,
    );
    if (!workspace) return null;

    try {
      const [row] = await db
        .insert(workQuantityItems)
        .values({
          organizationId,
          workQuantityListId: workspace.workQuantityList.id,
          positionNumber: data.positionNumber,
          code: data.code ?? null,
          description: data.description,
          unit: data.unit,
          quantity: data.quantity,
          notes: data.notes ?? null,
        })
        .returning();
      if (!row) throw new Error("Failed to create professional work quantity item.");
      return toWorkQuantityItem(row);
    } catch (error) {
      if (isUniqueConstraintConflict(error, "work_quantity_items_list_position_unique")) {
        throw new DuplicateWorkPositionError(data.positionNumber);
      }
      throw error;
    }
  }

  async updateWorkQuantityItem(
    organizationId: OrganizationId,
    calculationContextId: string,
    itemId: string,
    data: WorkQuantityItemUpdate,
  ): Promise<WorkQuantityItem | null> {
    const workspace = await this.getProfessionalEstimate(
      organizationId,
      calculationContextId,
    );
    if (!workspace) return null;

    try {
      const [row] = await db
        .update(workQuantityItems)
        .set({
          code: data.code ?? null,
          description: data.description,
          unit: data.unit,
          quantity: data.quantity,
          notes: data.notes ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workQuantityItems.organizationId, organizationId),
            eq(workQuantityItems.workQuantityListId, workspace.workQuantityList.id),
            eq(workQuantityItems.id, itemId),
          ),
        )
        .returning();
      return row ? toWorkQuantityItem(row) : null;
    } catch (error) {
      if (isUniqueConstraintConflict(error, "work_quantity_items_list_position_unique")) {
        // Position numbers are not editable in this milestone.
        throw new Error("Unexpected position conflict while updating an item.");
      }
      throw error;
    }
  }
}
