import { and, asc, desc, eq, max } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/infrastructure/db";
import { NormativeGovernanceValidationError } from "@/domain/professional-estimates/normative-governance.error";
import {
  normativeApplicabilityDecisions,
  normativeSourceRelations,
  normativeSources,
  normativeUpdateReviews,
  normativeUpdates,
  profiles,
} from "@/infrastructure/db/schema";
import type {
  CreateNormativeApplicabilityInput,
  CreateNormativeSourceRelationInput,
  CreateNormativeUpdateReviewInput,
  NormativeApplicabilityRecord,
  NormativeGovernanceRepository,
  NormativeSourceRelationRecord,
  NormativeUpdateReviewRecord,
} from "@/domain/professional-estimates/normative-governance.repository";
import type {
  NormativeApplicabilityDecision,
  NormativeSourceRelationType,
  NormativeUpdateReviewDecision,
} from "@/domain/professional-estimates/types";

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toReviewRecord(
  row: typeof normativeUpdateReviews.$inferSelect,
): NormativeUpdateReviewRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    updateId: row.updateId,
    sourceId: row.sourceId,
    decision: row.decision as NormativeUpdateReviewDecision,
    note: row.note,
    reviewerUserId: row.reviewerUserId,
    reviewerName: null,
    reviewedAt: row.reviewedAt,
    sourceCode: row.sourceCode,
    sourceEdition: row.sourceEdition,
    sourceAuthority: row.sourceAuthority,
    officialUri: row.officialUri,
    publicationDate: row.publicationDate,
    effectiveDate: row.effectiveDate,
    previousFingerprint: row.previousFingerprint,
    detectedFingerprint: row.detectedFingerprint,
  };
}

function toApplicabilityRecord(
  row: typeof normativeApplicabilityDecisions.$inferSelect,
): NormativeApplicabilityRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sourceId: row.sourceId,
    revision: row.revision,
    decision: row.decision as NormativeApplicabilityDecision,
    applicableFrom: row.applicableFrom,
    applicableUntil: row.applicableUntil,
    decidedAt: row.decidedAt,
    decidedByUserId: row.decidedByUserId,
    decidedByName: null,
    basisNote: row.basisNote,
    evidenceUri: row.evidenceUri,
    sourceCode: row.sourceCode,
    sourceEdition: row.sourceEdition,
    sourceAuthority: row.sourceAuthority,
    sourceUri: row.sourceUri,
    sourceFingerprint: row.sourceFingerprint,
    officialStatus: row.officialStatus,
    triggeringUpdateId: row.triggeringUpdateId,
  };
}

export class DrizzleNormativeGovernanceRepository
  implements NormativeGovernanceRepository
{
  async listUpdateReviews(
    organizationId: string,
  ): Promise<NormativeUpdateReviewRecord[]> {
    const rows = await db
      .select({
        review: normativeUpdateReviews,
        reviewerName: profiles.fullName,
      })
      .from(normativeUpdateReviews)
      .leftJoin(
        profiles,
        eq(normativeUpdateReviews.reviewerUserId, profiles.id),
      )
      .where(eq(normativeUpdateReviews.organizationId, organizationId))
      .orderBy(desc(normativeUpdateReviews.reviewedAt));
    return rows.map(({ review, reviewerName }) => ({
      ...toReviewRecord(review),
      reviewerName,
    }));
  }

  async listApplicabilityDecisions(
    organizationId: string,
  ): Promise<NormativeApplicabilityRecord[]> {
    const rows = await db
      .select({
        decision: normativeApplicabilityDecisions,
        decidedByName: profiles.fullName,
      })
      .from(normativeApplicabilityDecisions)
      .leftJoin(
        profiles,
        eq(normativeApplicabilityDecisions.decidedByUserId, profiles.id),
      )
      .where(
        eq(normativeApplicabilityDecisions.organizationId, organizationId),
      )
      .orderBy(
        asc(normativeApplicabilityDecisions.sourceId),
        desc(normativeApplicabilityDecisions.revision),
      );
    return rows.map(({ decision, decidedByName }) => ({
      ...toApplicabilityRecord(decision),
      decidedByName,
    }));
  }

  async listSourceRelations(
    organizationId: string,
  ): Promise<NormativeSourceRelationRecord[]> {
    const fromSource = alias(normativeSources, "from_source");
    const toSource = alias(normativeSources, "to_source");
    const rows = await db
      .select({
        relation: normativeSourceRelations,
        fromSourceCode: fromSource.code,
        fromSourceEdition: fromSource.edition,
        toSourceCode: toSource.code,
        toSourceEdition: toSource.edition,
        createdByName: profiles.fullName,
      })
      .from(normativeSourceRelations)
      .innerJoin(
        fromSource,
        and(
          eq(normativeSourceRelations.fromSourceId, fromSource.id),
          eq(normativeSourceRelations.organizationId, fromSource.organizationId),
        ),
      )
      .innerJoin(
        toSource,
        and(
          eq(normativeSourceRelations.toSourceId, toSource.id),
          eq(normativeSourceRelations.organizationId, toSource.organizationId),
        ),
      )
      .leftJoin(
        profiles,
        eq(normativeSourceRelations.createdByUserId, profiles.id),
      )
      .where(eq(normativeSourceRelations.organizationId, organizationId))
      .orderBy(desc(normativeSourceRelations.createdAt));

    return rows.map(({ relation, ...sources }) => ({
      id: relation.id,
      organizationId: relation.organizationId,
      fromSourceId: relation.fromSourceId,
      toSourceId: relation.toSourceId,
      ...sources,
      relationType: relation.relationType as NormativeSourceRelationType,
      effectiveDate: relation.effectiveDate,
      evidenceUri: relation.evidenceUri,
      note: relation.note,
      createdAt: relation.createdAt,
      createdByUserId: relation.createdByUserId,
      createdByName: sources.createdByName,
    }));
  }

  async createUpdateReview(
    input: CreateNormativeUpdateReviewInput,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          update: normativeUpdates,
          source: normativeSources,
        })
        .from(normativeUpdates)
        .innerJoin(
          normativeSources,
          and(
            eq(normativeUpdates.sourceId, normativeSources.id),
            eq(normativeUpdates.organizationId, normativeSources.organizationId),
          ),
        )
        .where(
          and(
            eq(normativeUpdates.organizationId, input.organizationId),
            eq(normativeUpdates.id, input.updateId),
          ),
        )
        .for("update");

      if (!row) throw new NormativeGovernanceValidationError("Modificarea detectată nu a fost găsită.");
      if (row.update.reviewStatus !== "detected") return;

      const reviewedAt = new Date();
      const metadata = objectValue(row.update.metadata);
      await tx.insert(normativeUpdateReviews).values({
        organizationId: input.organizationId,
        updateId: row.update.id,
        sourceId: row.source.id,
        reviewerUserId: input.reviewerUserId,
        decision: input.decision,
        note: input.note ?? null,
        sourceCode: row.source.code,
        sourceEdition: row.source.edition,
        sourceAuthority: row.source.authority,
        officialUri: row.update.officialUri ?? row.source.sourceUri,
        publicationDate: row.update.publicationDate,
        effectiveDate: row.update.effectiveDate,
        previousFingerprint: textValue(metadata.previousFingerprint),
        detectedFingerprint: row.update.eventFingerprint,
        reviewedAt,
      });

      await tx
        .update(normativeUpdates)
        .set({
          reviewStatus: input.decision === "dismissed" ? "dismissed" : "reviewed",
          reviewedAt,
        })
        .where(
          and(
            eq(normativeUpdates.organizationId, input.organizationId),
            eq(normativeUpdates.id, row.update.id),
            eq(normativeUpdates.reviewStatus, "detected"),
          ),
        );
    });
  }

  async createApplicabilityDecision(
    input: CreateNormativeApplicabilityInput,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(normativeSources)
        .where(
          and(
            eq(normativeSources.organizationId, input.organizationId),
            eq(normativeSources.id, input.sourceId),
          ),
        )
        .for("update");
      if (!source) throw new NormativeGovernanceValidationError("Sursa normativă nu a fost găsită.");
      if (
        input.decision === "applicable" &&
        source.officialStatus !== "in_force"
      ) {
        throw new NormativeGovernanceValidationError(
          "O sursă poate fi declarată aplicabilă numai după confirmarea statutului «În vigoare».",
        );
      }

      if (input.triggeringUpdateId) {
        const [update] = await tx
          .select({ id: normativeUpdates.id })
          .from(normativeUpdates)
          .where(
            and(
              eq(normativeUpdates.id, input.triggeringUpdateId),
              eq(normativeUpdates.sourceId, source.id),
              eq(normativeUpdates.organizationId, input.organizationId),
            ),
          )
          .limit(1);
        if (!update) {
          throw new NormativeGovernanceValidationError(
            "Modificarea selectată nu aparține acestei surse normative.",
          );
        }
        const [review] = await tx
          .select({ id: normativeUpdateReviews.id })
          .from(normativeUpdateReviews)
          .where(
            and(
              eq(normativeUpdateReviews.updateId, update.id),
              eq(normativeUpdateReviews.organizationId, input.organizationId),
            ),
          )
          .limit(1);
        if (!review) {
          throw new NormativeGovernanceValidationError(
            "Analiza umană a modificării trebuie înregistrată înaintea deciziei de aplicabilitate.",
          );
        }
      }

      const [latest] = await tx
        .select({ revision: max(normativeApplicabilityDecisions.revision) })
        .from(normativeApplicabilityDecisions)
        .where(
          and(
            eq(
              normativeApplicabilityDecisions.organizationId,
              input.organizationId,
            ),
            eq(normativeApplicabilityDecisions.sourceId, source.id),
          ),
        );
      const revision = (latest?.revision ?? 0) + 1;

      await tx.insert(normativeApplicabilityDecisions).values({
        organizationId: input.organizationId,
        sourceId: source.id,
        triggeringUpdateId: input.triggeringUpdateId ?? null,
        revision,
        decision: input.decision,
        applicableFrom: input.applicableFrom ?? null,
        applicableUntil: input.applicableUntil ?? null,
        decidedByUserId: input.decidedByUserId,
        basisNote: input.basisNote,
        evidenceUri: input.evidenceUri ?? source.sourceUri,
        sourceCode: source.code,
        sourceEdition: source.edition,
        sourceAuthority: source.authority,
        sourceUri: source.sourceUri,
        sourceFingerprint: source.contentFingerprint,
        officialStatus: source.officialStatus,
      });
    });
  }

  async createSourceRelation(
    input: CreateNormativeSourceRelationInput,
  ): Promise<void> {
    if (input.fromSourceId === input.toSourceId) {
      throw new NormativeGovernanceValidationError("O sursă normativă nu poate avea o relație cu ea însăși.");
    }
    const inserted = await db
      .insert(normativeSourceRelations)
      .values({
        organizationId: input.organizationId,
        fromSourceId: input.fromSourceId,
        toSourceId: input.toSourceId,
        relationType: input.relationType,
        effectiveDate: input.effectiveDate ?? null,
        evidenceUri: input.evidenceUri ?? null,
        note: input.note ?? null,
        createdByUserId: input.createdByUserId,
      })
      .onConflictDoNothing({
        target: [
          normativeSourceRelations.organizationId,
          normativeSourceRelations.fromSourceId,
          normativeSourceRelations.toSourceId,
          normativeSourceRelations.relationType,
        ],
      })
      .returning({ id: normativeSourceRelations.id });
    if (inserted.length === 0) {
      throw new NormativeGovernanceValidationError("Această relație între surse este deja înregistrată.");
    }
  }
}
