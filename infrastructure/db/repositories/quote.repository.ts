import { and, eq, desc, inArray, max } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/infrastructure/db";
import {
  quotes,
  quoteVersions,
  quoteItems,
} from "@/infrastructure/db/schema";
import type {
  OrganizationId,
  ProjectId,
  QuoteId,
  QuoteVersionId,
  QuoteStatus,
  SupportedUnit,
} from "@/domain/shared/types";
import type {
  CreateQuoteData,
  DraftUpdate,
  ProjectQuoteSummary,
  Quote,
  QuoteItem,
  QuoteRepository,
  QuoteSummary,
  QuoteVersion,
  QuoteWithVersion,
} from "@/domain/quotes/quote.repository";

function quoteToDomain(row: typeof quotes.$inferSelect): Quote {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function itemToDomain(row: typeof quoteItems.$inferSelect): QuoteItem {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    catalogItemId: row.catalogItemId,
    name: row.name,
    description: row.description,
    unit: row.unit as SupportedUnit,
    unitPrice: row.unitPrice,
    quantity: row.quantity,
    discountPct: row.discountPct,
    lineTotal: row.lineTotal,
  };
}

function versionToDomain(
  row: typeof quoteVersions.$inferSelect,
  items: QuoteItem[],
): QuoteVersion {
  return {
    id: row.id,
    quoteId: row.quoteId,
    organizationId: row.organizationId,
    versionNumber: row.versionNumber,
    status: row.status as QuoteStatus,
    currency: row.currency,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    projectName: row.projectName,
    projectAddress: row.projectAddress,
    notes: row.notes,
    validityDays: row.validityDays,
    discountPct: row.discountPct,
    vatRate: row.vatRate,
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    taxableAmount: row.taxableAmount,
    vatAmount: row.vatAmount,
    total: row.total,
    items,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleQuoteRepository implements QuoteRepository {
  async createQuoteWithFirstVersion(
    organizationId: OrganizationId,
    data: CreateQuoteData,
  ): Promise<QuoteWithVersion> {
    return db.transaction(async (tx) => {
      const [quoteRow] = await tx
        .insert(quotes)
        .values({ organizationId, projectId: data.projectId ?? null })
        .returning();

      const [versionRow] = await tx
        .insert(quoteVersions)
        .values({
          organizationId,
          quoteId: quoteRow!.id,
          versionNumber: 1,
          status: "draft",
          currency: data.currency,
          vatRate: data.vatRate,
          customerName: data.snapshot.customerName ?? null,
          customerEmail: data.snapshot.customerEmail ?? null,
          customerPhone: data.snapshot.customerPhone ?? null,
          projectName: data.snapshot.projectName ?? null,
          projectAddress: data.snapshot.projectAddress ?? null,
        })
        .returning();

      return {
        quote: quoteToDomain(quoteRow!),
        version: versionToDomain(versionRow!, []),
      };
    });
  }

  async getVersion(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
  ): Promise<QuoteWithVersion | null> {
    const [versionRow] = await db
      .select()
      .from(quoteVersions)
      .where(
        and(
          eq(quoteVersions.organizationId, organizationId),
          eq(quoteVersions.id, versionId),
        ),
      )
      .limit(1);
    if (!versionRow) return null;

    const [quoteRow] = await db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.organizationId, organizationId),
          eq(quotes.id, versionRow.quoteId),
        ),
      )
      .limit(1);
    if (!quoteRow) return null;

    const itemRows = await db
      .select()
      .from(quoteItems)
      .where(
        and(
          eq(quoteItems.organizationId, organizationId),
          eq(quoteItems.quoteVersionId, versionId),
        ),
      )
      .orderBy(quoteItems.sortOrder);

    return {
      quote: quoteToDomain(quoteRow),
      version: versionToDomain(versionRow, itemRows.map(itemToDomain)),
    };
  }

  async getLatestVersionId(
    organizationId: OrganizationId,
    quoteId: QuoteId,
  ): Promise<QuoteVersionId | null> {
    const [row] = await db
      .select({ id: quoteVersions.id })
      .from(quoteVersions)
      .where(
        and(
          eq(quoteVersions.organizationId, organizationId),
          eq(quoteVersions.quoteId, quoteId),
        ),
      )
      .orderBy(desc(quoteVersions.versionNumber))
      .limit(1);
    return row?.id ?? null;
  }

  async saveDraft(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    update: DraftUpdate,
    computed: {
      lineTotals: string[];
      subtotal: string;
      discountAmount: string;
      taxableAmount: string;
      vatAmount: string;
      total: string;
    },
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Find the parent quote id so we can refresh its timestamp afterwards.
      const [versionRow] = await tx
        .select({ quoteId: quoteVersions.quoteId })
        .from(quoteVersions)
        .where(
          and(
            eq(quoteVersions.organizationId, organizationId),
            eq(quoteVersions.id, versionId),
          ),
        )
        .limit(1);

      // Replace all items: delete existing, insert the new set with totals.
      await tx
        .delete(quoteItems)
        .where(
          and(
            eq(quoteItems.organizationId, organizationId),
            eq(quoteItems.quoteVersionId, versionId),
          ),
        );

      if (update.items.length > 0) {
        await tx.insert(quoteItems).values(
          update.items.map((item, index) => ({
            organizationId,
            quoteVersionId: versionId,
            sortOrder: index,
            catalogItemId: item.catalogItemId ?? null,
            name: item.name,
            description: item.description ?? null,
            unit: item.unit,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            discountPct: item.discountPct ?? "0",
            lineTotal: computed.lineTotals[index]!,
          })),
        );
      }

      await tx
        .update(quoteVersions)
        .set({
          notes: update.notes ?? null,
          validityDays: update.validityDays ?? null,
          discountPct: update.discountPct,
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxableAmount: computed.taxableAmount,
          vatAmount: computed.vatAmount,
          total: computed.total,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(quoteVersions.organizationId, organizationId),
            eq(quoteVersions.id, versionId),
          ),
        );

      // Touch the parent quote so its list ordering reflects recent edits.
      if (versionRow) {
        await tx
          .update(quotes)
          .set({ updatedAt: new Date() })
          .where(
            and(
              eq(quotes.organizationId, organizationId),
              eq(quotes.id, versionRow.quoteId),
            ),
          );
      }
    });
  }

  async listByProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<QuoteSummary[]> {
    // Quotes belonging to the project.
    const quoteRows = await db
      .select({ id: quotes.id, updatedAt: quotes.updatedAt })
      .from(quotes)
      .where(
        and(
          eq(quotes.organizationId, organizationId),
          eq(quotes.projectId, projectId),
        ),
      )
      .orderBy(desc(quotes.updatedAt));

    if (quoteRows.length === 0) return [];
    const quoteIds = quoteRows.map((q) => q.id);

    // Highest version number per quote.
    const latest = await db
      .select({
        quoteId: quoteVersions.quoteId,
        latest: max(quoteVersions.versionNumber),
      })
      .from(quoteVersions)
      .where(
        and(
          eq(quoteVersions.organizationId, organizationId),
          inArray(quoteVersions.quoteId, quoteIds),
        ),
      )
      .groupBy(quoteVersions.quoteId);

    const latestByQuote = new Map(latest.map((r) => [r.quoteId, r.latest]));

    // Fetch the version rows that match those latest numbers.
    const versionRows = await db
      .select()
      .from(quoteVersions)
      .where(
        and(
          eq(quoteVersions.organizationId, organizationId),
          inArray(quoteVersions.quoteId, quoteIds),
        ),
      );

    const summaries: QuoteSummary[] = [];
    for (const q of quoteRows) {
      const latestNumber = latestByQuote.get(q.id);
      if (latestNumber == null) continue;
      const version = versionRows.find(
        (v) => v.quoteId === q.id && v.versionNumber === latestNumber,
      );
      if (!version) continue;
      summaries.push({
        quoteId: q.id,
        versionId: version.id,
        versionNumber: version.versionNumber,
        status: version.status as QuoteStatus,
        currency: version.currency,
        total: version.total,
        updatedAt: q.updatedAt,
      });
    }
    return summaries;
  }

  async listProjectQuoteSummaries(
    organizationId: OrganizationId,
  ): Promise<ProjectQuoteSummary[]> {
    // All quotes in the org that belong to a project.
    const quoteRows = await db
      .select({ id: quotes.id, projectId: quotes.projectId })
      .from(quotes)
      .where(eq(quotes.organizationId, organizationId));

    const withProject = quoteRows.filter((q) => q.projectId != null);
    if (withProject.length === 0) return [];
    const quoteIds = withProject.map((q) => q.id);

    // Highest version number per quote.
    const latest = await db
      .select({
        quoteId: quoteVersions.quoteId,
        latest: max(quoteVersions.versionNumber),
      })
      .from(quoteVersions)
      .where(
        and(
          eq(quoteVersions.organizationId, organizationId),
          inArray(quoteVersions.quoteId, quoteIds),
        ),
      )
      .groupBy(quoteVersions.quoteId);
    const latestByQuote = new Map(latest.map((r) => [r.quoteId, r.latest]));

    const versionRows = await db
      .select({
        quoteId: quoteVersions.quoteId,
        versionNumber: quoteVersions.versionNumber,
        currency: quoteVersions.currency,
        total: quoteVersions.total,
      })
      .from(quoteVersions)
      .where(
        and(
          eq(quoteVersions.organizationId, organizationId),
          inArray(quoteVersions.quoteId, quoteIds),
        ),
      );

    // Sum the latest-version totals per project using Decimal for safety.
    const byProject = new Map<
      ProjectId,
      { count: number; total: Decimal; currency: string }
    >();
    for (const q of withProject) {
      const latestNumber = latestByQuote.get(q.id);
      if (latestNumber == null) continue;
      const version = versionRows.find(
        (v) => v.quoteId === q.id && v.versionNumber === latestNumber,
      );
      if (!version) continue;
      const projectId = q.projectId as ProjectId;
      const entry = byProject.get(projectId) ?? {
        count: 0,
        total: new Decimal(0),
        currency: version.currency,
      };
      entry.count += 1;
      entry.total = entry.total.plus(new Decimal(version.total));
      byProject.set(projectId, entry);
    }

    return Array.from(byProject.entries()).map(([projectId, e]) => ({
      projectId,
      quoteCount: e.count,
      total: e.total.toFixed(2),
      currency: e.currency,
    }));
  }
}
