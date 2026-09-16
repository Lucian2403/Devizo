import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import {
  quotes,
  quoteItems,
  quoteVersions,
} from "@/infrastructure/db/schema";
import type {
  OrganizationId,
  QuoteStatus,
  QuoteVersionId,
  SupportedUnit,
} from "@/domain/shared/types";
import type {
  Quote,
  QuoteItem,
  QuoteVersion,
  QuoteWithVersion,
} from "@/domain/quotes/quote.repository";
import { DrizzleQuoteRepository } from "./quote.repository";

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
    snapshotCapturedAt: row.snapshotCapturedAt,
    sourceProjectId: row.sourceProjectId,
    sourceCustomerId: row.sourceCustomerId,
    documentNumber: row.documentNumber,
    documentYear: row.documentYear,
    documentSequence: row.documentSequence,
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

/**
 * Uses the normal quote repository for writes and list operations, but serves
 * the hot version-read path in one database round trip instead of three.
 */
export class JoinedReadDrizzleQuoteRepository extends DrizzleQuoteRepository {
  override async getVersion(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
  ): Promise<QuoteWithVersion | null> {
    const rows = await db
      .select({
        quote: quotes,
        version: quoteVersions,
        item: quoteItems,
      })
      .from(quoteVersions)
      .innerJoin(
        quotes,
        and(
          eq(quotes.id, quoteVersions.quoteId),
          eq(quotes.organizationId, organizationId),
        ),
      )
      .leftJoin(
        quoteItems,
        and(
          eq(quoteItems.quoteVersionId, quoteVersions.id),
          eq(quoteItems.organizationId, organizationId),
        ),
      )
      .where(
        and(
          eq(quoteVersions.organizationId, organizationId),
          eq(quoteVersions.id, versionId),
        ),
      )
      .orderBy(quoteItems.sortOrder);

    const firstRow = rows[0];
    if (!firstRow) return null;

    const items = rows.flatMap((row) =>
      row.item ? [itemToDomain(row.item)] : [],
    );

    return {
      quote: quoteToDomain(firstRow.quote),
      version: versionToDomain(firstRow.version, items),
    };
  }
}
