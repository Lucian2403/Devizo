import { and, eq, desc, inArray, max } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "@/infrastructure/db";
import {
  quotes,
  quoteVersions,
  quoteItems,
  auditEvents,
} from "@/infrastructure/db/schema";
import type {
  OrganizationId,
  ProjectId,
  QuoteId,
  QuoteVersionId,
  QuoteStatus,
  SupportedUnit,
  UserId,
} from "@/domain/shared/types";
import type {
  CreateQuoteData,
  CompanySnapshot,
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
    companyName: row.companyName,
    companyLegalName: row.companyLegalName,
    companyTaxVatId: row.companyTaxVatId,
    companyEmail: row.companyEmail,
    companyPhone: row.companyPhone,
    companyAddress: row.companyAddress,
    companyCountry: row.companyCountry,
    documentLanguage: row.documentLanguage,
    paymentTerms: row.paymentTerms,
    executionDuration: row.executionDuration,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    companyTerms: row.companyTerms,
    sentAt: row.sentAt,
    validUntil: row.validUntil,
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

  async markVersionSent(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    actorUserId: UserId,
    snapshot: CompanySnapshot,
    validUntil: Date | null,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Re-read under the transaction and guard the draft precondition, so two
      // concurrent sends can never both freeze the same version.
      const [versionRow] = await tx
        .select({
          quoteId: quoteVersions.quoteId,
          status: quoteVersions.status,
        })
        .from(quoteVersions)
        .where(
          and(
            eq(quoteVersions.organizationId, organizationId),
            eq(quoteVersions.id, versionId),
          ),
        )
        .limit(1);

      if (!versionRow) throw new Error("Quote version not found.");
      if (versionRow.status !== "draft") {
        throw new Error("Only draft quote versions can be sent.");
      }

      const now = new Date();
      await tx
        .update(quoteVersions)
        .set({
          status: "sent",
          companyName: snapshot.companyName,
          companyLegalName: snapshot.companyLegalName,
          companyTaxVatId: snapshot.companyTaxVatId,
          companyEmail: snapshot.companyEmail,
          companyPhone: snapshot.companyPhone,
          companyAddress: snapshot.companyAddress,
          companyCountry: snapshot.companyCountry,
          documentLanguage: snapshot.documentLanguage,
          paymentTerms: snapshot.paymentTerms,
          executionDuration: snapshot.executionDuration,
          inclusions: snapshot.inclusions,
          exclusions: snapshot.exclusions,
          companyTerms: snapshot.companyTerms,
          sentAt: now,
          validUntil,
          updatedAt: now,
        })
        .where(
          and(
            eq(quoteVersions.organizationId, organizationId),
            eq(quoteVersions.id, versionId),
          ),
        );

      await tx.insert(auditEvents).values({
        organizationId,
        quoteId: versionRow.quoteId,
        quoteVersionId: versionId,
        actorUserId,
        eventType: "quote_sent",
      });
    });
  }

  async createDraftFromVersion(
    organizationId: OrganizationId,
    sourceVersionId: QuoteVersionId,
  ): Promise<QuoteVersionId> {
    return db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(quoteVersions)
        .where(
          and(
            eq(quoteVersions.organizationId, organizationId),
            eq(quoteVersions.id, sourceVersionId),
          ),
        )
        .limit(1);
      if (!source) throw new Error("Quote version not found.");

      // Next version number = current max for this quote + 1.
      const [{ latest } = { latest: null }] = await tx
        .select({ latest: max(quoteVersions.versionNumber) })
        .from(quoteVersions)
        .where(
          and(
            eq(quoteVersions.organizationId, organizationId),
            eq(quoteVersions.quoteId, source.quoteId),
          ),
        );
      const nextNumber = (latest ?? source.versionNumber) + 1;

      // Clone the version snapshot as a fresh draft. Computed totals are carried
      // over verbatim; they are recomputed on the next saveDraft anyway.
      const [newVersion] = await tx
        .insert(quoteVersions)
        .values({
          organizationId,
          quoteId: source.quoteId,
          versionNumber: nextNumber,
          status: "draft",
          currency: source.currency,
          customerName: source.customerName,
          customerEmail: source.customerEmail,
          customerPhone: source.customerPhone,
          projectName: source.projectName,
          projectAddress: source.projectAddress,
          notes: source.notes,
          validityDays: source.validityDays,
          discountPct: source.discountPct,
          vatRate: source.vatRate,
          subtotal: source.subtotal,
          discountAmount: source.discountAmount,
          taxableAmount: source.taxableAmount,
          vatAmount: source.vatAmount,
          total: source.total,
        })
        .returning();

      // Clone all item snapshots into the new draft version.
      const sourceItems = await tx
        .select()
        .from(quoteItems)
        .where(
          and(
            eq(quoteItems.organizationId, organizationId),
            eq(quoteItems.quoteVersionId, sourceVersionId),
          ),
        )
        .orderBy(quoteItems.sortOrder);

      if (sourceItems.length > 0) {
        await tx.insert(quoteItems).values(
          sourceItems.map((item) => ({
            organizationId,
            quoteVersionId: newVersion!.id,
            sortOrder: item.sortOrder,
            catalogItemId: item.catalogItemId,
            name: item.name,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            discountPct: item.discountPct,
            lineTotal: item.lineTotal,
          })),
        );
      }

      // Touch the parent quote so list ordering reflects the new draft.
      await tx
        .update(quotes)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(quotes.organizationId, organizationId),
            eq(quotes.id, source.quoteId),
          ),
        );

      return newVersion!.id;
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

  async listByProjectStatuses(
    organizationId: OrganizationId,
    projectId: ProjectId,
    statuses: QuoteStatus[],
  ): Promise<QuoteSummary[]> {
    if (statuses.length === 0) return [];

    const rows = await db
      .select({
        quoteId: quoteVersions.quoteId,
        versionId: quoteVersions.id,
        versionNumber: quoteVersions.versionNumber,
        status: quoteVersions.status,
        currency: quoteVersions.currency,
        total: quoteVersions.total,
        updatedAt: quoteVersions.updatedAt,
      })
      .from(quoteVersions)
      .innerJoin(
        quotes,
        and(
          eq(quotes.id, quoteVersions.quoteId),
          eq(quotes.organizationId, quoteVersions.organizationId),
        ),
      )
      .where(
        and(
          eq(quoteVersions.organizationId, organizationId),
          eq(quotes.projectId, projectId),
          inArray(quoteVersions.status, statuses),
        ),
      )
      .orderBy(desc(quoteVersions.updatedAt), desc(quoteVersions.versionNumber));

    return rows.map((row) => ({
      quoteId: row.quoteId,
      versionId: row.versionId,
      versionNumber: row.versionNumber,
      status: row.status as QuoteStatus,
      currency: row.currency,
      total: row.total,
      updatedAt: row.updatedAt,
    }));
  }

  async deleteQuote(
    organizationId: OrganizationId,
    quoteId: QuoteId,
  ): Promise<void> {
    await db
      .delete(quotes)
      .where(
        and(eq(quotes.organizationId, organizationId), eq(quotes.id, quoteId)),
      );
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
