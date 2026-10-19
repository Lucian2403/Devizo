import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { professionalCostComponentDecisions } from "@/infrastructure/db/schema";
import type {
  ProfessionalCostComponentDecisionRecord,
  ProfessionalCostComponentDecisionRepository,
  UpsertProfessionalCostComponentDecisionInput,
} from "@/domain/professional-estimates/professional-cost-component-decisions.repository";
import type { PersistedCostComponent } from "@/domain/professional-estimates/professional-cost-component-decisions.repository";

function toRecord(
  row: typeof professionalCostComponentDecisions.$inferSelect,
): ProfessionalCostComponentDecisionRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    calculationContextId: row.calculationContextId,
    component: row.component as PersistedCostComponent,
    decision: row.decision as "applied" | "not_applicable",
    professionalRuleDefinitionId: row.professionalRuleDefinitionId,
    reason: row.reason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleProfessionalCostComponentDecisionRepository
  implements ProfessionalCostComponentDecisionRepository
{
  async listForContext(
    organizationId: string,
    calculationContextId: string,
  ): Promise<ProfessionalCostComponentDecisionRecord[]> {
    const rows = await db
      .select()
      .from(professionalCostComponentDecisions)
      .where(
        and(
          eq(professionalCostComponentDecisions.organizationId, organizationId),
          eq(
            professionalCostComponentDecisions.calculationContextId,
            calculationContextId,
          ),
        ),
      );
    return rows.map(toRecord);
  }

  async upsert(
    input: UpsertProfessionalCostComponentDecisionInput,
  ): Promise<ProfessionalCostComponentDecisionRecord> {
    const [row] = await db
      .insert(professionalCostComponentDecisions)
      .values({
        organizationId: input.organizationId,
        calculationContextId: input.calculationContextId,
        component: input.component,
        decision: input.decision,
        professionalRuleDefinitionId: input.professionalRuleDefinitionId,
        reason: input.reason,
      })
      .onConflictDoUpdate({
        target: [
          professionalCostComponentDecisions.organizationId,
          professionalCostComponentDecisions.calculationContextId,
          professionalCostComponentDecisions.component,
        ],
        set: {
          decision: input.decision,
          professionalRuleDefinitionId: input.professionalRuleDefinitionId,
          reason: input.reason,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) {
      throw new Error("Failed to save professional cost component decision.");
    }
    return toRecord(row);
  }
}
