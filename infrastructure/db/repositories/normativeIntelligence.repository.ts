import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import {
  calculationRules,
  estimateNormVersions,
  normativeSources,
  normativeUpdates,
  professionalResources,
  resourcePrices,
} from "@/infrastructure/db/schema";
import type {
  DetectedNormativeUpdateInput,
  NormativeIntelligenceRepository,
  NormativeSourceOverview,
  NormativeSourceRecord,
  NormativeSourceUpsertInput,
  NormativeSourceUsage,
  NormativeUpdateRecord,
  SourceVerificationResult,
} from "@/domain/professional-estimates/normative-intelligence.repository";
import type {
  NormativeReviewStatus,
  NormativeSourceType,
  NormativeUpdateType,
  OfficialSourceStatus,
  SourceVerificationStatus,
} from "@/domain/professional-estimates/types";

function metadataObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toSourceRecord(
  row: typeof normativeSources.$inferSelect,
): NormativeSourceRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    title: row.title,
    edition: row.edition,
    sourceType: row.sourceType as NormativeSourceType,
    publisher: row.publisher,
    jurisdiction: row.jurisdiction,
    authority: row.authority,
    sourceUri: row.sourceUri,
    approvalDate: row.approvalDate,
    publicationDate: row.publicationDate,
    effectiveDate: row.effectiveDate,
    validFrom: row.validFrom,
    validTo: row.validTo,
    status: row.status as NormativeSourceRecord["status"],
    officialStatus: row.officialStatus as OfficialSourceStatus,
    monitoringEnabled: row.monitoringEnabled,
    lastVerifiedAt: row.lastVerifiedAt,
    lastVerificationStatus:
      row.lastVerificationStatus as SourceVerificationStatus,
    lastVerificationError: row.lastVerificationError,
    contentFingerprint: row.contentFingerprint,
    metadata: metadataObject(row.metadata),
  };
}

export class DrizzleNormativeIntelligenceRepository
  implements NormativeIntelligenceRepository
{
  async listSources(
    organizationId: string,
  ): Promise<NormativeSourceOverview[]> {
    const rows = await db
      .select()
      .from(normativeSources)
      .where(eq(normativeSources.organizationId, organizationId))
      .orderBy(asc(normativeSources.code), asc(normativeSources.edition));

    return Promise.all(
      rows.map(async (row) => ({
        ...toSourceRecord(row),
        usage: await this.getUsage(organizationId, row.id),
      })),
    );
  }

  async listUpdates(
    organizationId: string,
    limit = 50,
  ): Promise<NormativeUpdateRecord[]> {
    const rows = await db
      .select({
        update: normativeUpdates,
        sourceCode: normativeSources.code,
        sourceTitle: normativeSources.title,
      })
      .from(normativeUpdates)
      .innerJoin(
        normativeSources,
        and(
          eq(normativeUpdates.sourceId, normativeSources.id),
          eq(normativeUpdates.organizationId, normativeSources.organizationId),
        ),
      )
      .where(eq(normativeUpdates.organizationId, organizationId))
      .orderBy(desc(normativeUpdates.detectedAt))
      .limit(limit);

    return rows.map(({ update, sourceCode, sourceTitle }) => ({
      id: update.id,
      organizationId: update.organizationId,
      sourceId: update.sourceId,
      sourceCode,
      sourceTitle,
      updateType: update.updateType as NormativeUpdateType,
      reviewStatus: update.reviewStatus as NormativeReviewStatus,
      title: update.title,
      summary: update.summary,
      impactSummary: update.impactSummary,
      officialUri: update.officialUri,
      publicationDate: update.publicationDate,
      effectiveDate: update.effectiveDate,
      eventFingerprint: update.eventFingerprint,
      detectedAt: update.detectedAt,
      reviewedAt: update.reviewedAt,
      metadata: metadataObject(update.metadata),
    }));
  }

  async upsertSources(
    organizationId: string,
    sources: NormativeSourceUpsertInput[],
  ): Promise<number> {
    if (sources.length === 0) return 0;

    for (const source of sources) {
      await db
        .insert(normativeSources)
        .values({
          organizationId,
          code: source.code,
          title: source.title,
          edition: source.edition,
          sourceType: source.sourceType,
          publisher: source.publisher ?? null,
          jurisdiction: source.jurisdiction ?? "MD",
          authority: source.authority ?? null,
          sourceUri: source.sourceUri ?? null,
          approvalDate: source.approvalDate ?? null,
          publicationDate: source.publicationDate ?? null,
          effectiveDate: source.effectiveDate ?? null,
          validFrom: source.validFrom ?? null,
          validTo: source.validTo ?? null,
          status: source.status ?? "active",
          officialStatus: source.officialStatus ?? "unknown",
          monitoringEnabled: source.monitoringEnabled ?? false,
          metadata: source.metadata ?? {},
        })
        .onConflictDoUpdate({
          target: [
            normativeSources.organizationId,
            normativeSources.code,
            normativeSources.edition,
          ],
          set: {
            title: source.title,
            sourceType: source.sourceType,
            publisher: source.publisher ?? null,
            jurisdiction: source.jurisdiction ?? "MD",
            authority: source.authority ?? null,
            sourceUri: source.sourceUri ?? null,
            approvalDate: source.approvalDate ?? null,
            publicationDate: source.publicationDate ?? null,
            effectiveDate: source.effectiveDate ?? null,
            validFrom: source.validFrom ?? null,
            validTo: source.validTo ?? null,
            status: source.status ?? "active",
            officialStatus: source.officialStatus ?? "unknown",
            monitoringEnabled: source.monitoringEnabled ?? false,
            metadata: source.metadata ?? {},
            updatedAt: new Date(),
          },
        });
    }

    return sources.length;
  }

  async listMonitoredSources(
    organizationId?: string,
  ): Promise<NormativeSourceRecord[]> {
    const where = organizationId
      ? and(
          eq(normativeSources.organizationId, organizationId),
          eq(normativeSources.monitoringEnabled, true),
        )
      : eq(normativeSources.monitoringEnabled, true);

    const rows = await db
      .select()
      .from(normativeSources)
      .where(where)
      .orderBy(asc(normativeSources.organizationId), asc(normativeSources.code));

    return rows.map(toSourceRecord);
  }

  async getUsage(
    organizationId: string,
    sourceId: string,
  ): Promise<NormativeSourceUsage> {
    const [normVersionRows, resourceRows, priceRows, ruleRows] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(estimateNormVersions)
          .where(
            and(
              eq(estimateNormVersions.organizationId, organizationId),
              eq(estimateNormVersions.sourceId, sourceId),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(professionalResources)
          .where(
            and(
              eq(professionalResources.organizationId, organizationId),
              eq(professionalResources.sourceId, sourceId),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(resourcePrices)
          .where(
            and(
              eq(resourcePrices.organizationId, organizationId),
              eq(resourcePrices.sourceId, sourceId),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(calculationRules)
          .where(
            and(
              eq(calculationRules.organizationId, organizationId),
              eq(calculationRules.sourceId, sourceId),
            ),
          ),
      ]);

    return {
      normVersions: normVersionRows[0]?.count ?? 0,
      resources: resourceRows[0]?.count ?? 0,
      resourcePrices: priceRows[0]?.count ?? 0,
      calculationRules: ruleRows[0]?.count ?? 0,
    };
  }

  async saveVerification(
    organizationId: string,
    sourceId: string,
    result: SourceVerificationResult,
  ): Promise<void> {
    await db
      .update(normativeSources)
      .set({
        lastVerifiedAt: result.checkedAt,
        lastVerificationStatus: result.status,
        lastVerificationError: result.error ?? null,
        ...(result.status === "success" && result.fingerprint
          ? { contentFingerprint: result.fingerprint }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(normativeSources.organizationId, organizationId),
          eq(normativeSources.id, sourceId),
        ),
      );
  }

  async recordDetectedUpdate(
    input: DetectedNormativeUpdateInput,
  ): Promise<void> {
    await db
      .insert(normativeUpdates)
      .values({
        organizationId: input.organizationId,
        sourceId: input.sourceId,
        updateType: input.updateType,
        title: input.title,
        summary: input.summary ?? null,
        impactSummary: input.impactSummary ?? null,
        officialUri: input.officialUri ?? null,
        publicationDate: input.publicationDate ?? null,
        effectiveDate: input.effectiveDate ?? null,
        eventFingerprint: input.eventFingerprint,
        metadata: input.metadata ?? {},
      })
      .onConflictDoNothing({
        target: [
          normativeUpdates.organizationId,
          normativeUpdates.sourceId,
          normativeUpdates.eventFingerprint,
        ],
      });
  }

  async setUpdateReviewStatus(
    organizationId: string,
    updateId: string,
    status: "reviewed" | "dismissed",
  ): Promise<void> {
    await db
      .update(normativeUpdates)
      .set({
        reviewStatus: status,
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(normativeUpdates.organizationId, organizationId),
          eq(normativeUpdates.id, updateId),
        ),
      );
  }
}
