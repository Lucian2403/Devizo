import type {
  OrganizationId,
  QuoteId,
  QuoteVersionId,
} from "@/domain/shared/types";
import { computeTotals } from "./pricing";
import type {
  CreateQuoteData,
  DraftUpdate,
  ProjectQuoteSummary,
  QuoteRepository,
  QuoteSummary,
  QuoteWithVersion,
} from "./quote.repository";

export class QuoteVersionNotFoundError extends Error {
  constructor() {
    super("Quote version not found.");
    this.name = "QuoteVersionNotFoundError";
  }
}

// Thrown when an edit is attempted on a version that is no longer a draft.
export class QuoteNotEditableError extends Error {
  constructor() {
    super("Only draft quote versions can be edited.");
    this.name = "QuoteNotEditableError";
  }
}

/**
 * Business logic for quotes. All money is computed here via the pricing engine
 * and stored on the version; the client never sends totals we trust.
 */
export class QuoteService {
  constructor(private readonly repository: QuoteRepository) {}

  createQuote(
    organizationId: OrganizationId,
    data: CreateQuoteData,
  ): Promise<QuoteWithVersion> {
    return this.repository.createQuoteWithFirstVersion(organizationId, data);
  }

  async getVersion(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
  ): Promise<QuoteWithVersion> {
    const found = await this.repository.getVersion(organizationId, versionId);
    if (!found) throw new QuoteVersionNotFoundError();
    return found;
  }

  getLatestVersionId(
    organizationId: OrganizationId,
    quoteId: QuoteId,
  ): Promise<QuoteVersionId | null> {
    return this.repository.getLatestVersionId(organizationId, quoteId);
  }

  listByProject(
    organizationId: OrganizationId,
    projectId: string,
  ): Promise<QuoteSummary[]> {
    return this.repository.listByProject(organizationId, projectId);
  }

  listProjectQuoteSummaries(
    organizationId: OrganizationId,
  ): Promise<ProjectQuoteSummary[]> {
    return this.repository.listProjectQuoteSummaries(organizationId);
  }

  /**
   * Saves a draft: recomputes every total server-side, then persists the items
   * and totals together. Refuses to edit a non-draft version.
   */
  async saveDraft(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    update: DraftUpdate,
  ): Promise<void> {
    const found = await this.repository.getVersion(organizationId, versionId);
    if (!found) throw new QuoteVersionNotFoundError();
    if (found.version.status !== "draft") throw new QuoteNotEditableError();

    const computed = computeTotals({
      lines: update.items.map((item) => ({
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discountPct: item.discountPct ?? "0",
      })),
      quoteDiscountPct: update.discountPct,
      vatRate: found.version.vatRate,
    });

    await this.repository.saveDraft(
      organizationId,
      versionId,
      update,
      computed,
    );
  }
}
