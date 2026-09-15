import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import {
  auditEvents,
  quotes,
  quoteVersions,
} from "@/infrastructure/db/schema";
import type {
  OrganizationId,
  QuoteVersionId,
  UserId,
} from "@/domain/shared/types";
import type {
  QuoteDecision,
  QuoteDecisionRepository,
  QuoteDecisionWriteResult,
} from "@/domain/quotes/quote-decision.service";

export class DrizzleQuoteDecisionRepository implements QuoteDecisionRepository {
  async applyDecision(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    actorUserId: UserId,
    decision: QuoteDecision,
  ): Promise<QuoteDecisionWriteResult> {
    return db.transaction(async (tx) => {
      const now = new Date();

      const [updatedVersion] = await tx
        .update(quoteVersions)
        .set({ status: decision, updatedAt: now })
        .where(
          and(
            eq(quoteVersions.organizationId, organizationId),
            eq(quoteVersions.id, versionId),
            eq(quoteVersions.status, "sent"),
          ),
        )
        .returning({ quoteId: quoteVersions.quoteId });

      if (!updatedVersion) {
        const [existingVersion] = await tx
          .select({ id: quoteVersions.id })
          .from(quoteVersions)
          .where(
            and(
              eq(quoteVersions.organizationId, organizationId),
              eq(quoteVersions.id, versionId),
            ),
          )
          .limit(1);

        return existingVersion ? "invalid_status" : "not_found";
      }

      await tx
        .update(quotes)
        .set({ updatedAt: now })
        .where(
          and(
            eq(quotes.organizationId, organizationId),
            eq(quotes.id, updatedVersion.quoteId),
          ),
        );

      await tx.insert(auditEvents).values({
        organizationId,
        quoteId: updatedVersion.quoteId,
        quoteVersionId: versionId,
        actorUserId,
        eventType:
          decision === "accepted" ? "quote_accepted" : "quote_rejected",
      });

      return "updated";
    });
  }
}
