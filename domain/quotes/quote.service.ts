import type {
  OrganizationId,
  QuoteId,
  QuoteStatus,
  QuoteVersionId,
  UserId,
} from "@/domain/shared/types";
import Decimal from "decimal.js";
import { computeTotals } from "./pricing";
import type {
  CompanySnapshot,
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

// Thrown when a version cannot be sent (not a draft, empty, or invalid totals).
export class QuoteNotSendableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteNotSendableError";
  }
}

// Thrown when a new draft cannot be created from the given source version.
export class QuoteVersionNotCloneableError extends Error {
  constructor() {
    super("Only sent or rejected versions can start a new draft version.");
    this.name = "QuoteVersionNotCloneableError";
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

  listByProjectStatuses(
    organizationId: OrganizationId,
    projectId: string,
    statuses: QuoteStatus[],
  ): Promise<QuoteSummary[]> {
    return this.repository.listByProjectStatuses(
      organizationId,
      projectId,
      statuses,
    );
  }

  listProjectQuoteSummaries(
    organizationId: OrganizationId,
  ): Promise<ProjectQuoteSummary[]> {
    return this.repository.listProjectQuoteSummaries(organizationId);
  }

  async deleteQuote(
    organizationId: OrganizationId,
    quoteId: QuoteId,
  ): Promise<void> {
    await this.repository.deleteQuote(organizationId, quoteId);
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

  /**
   * Freezes a draft version as the immutable commercial document ('sent').
   * Validates the saved snapshot (never the AI assistant's unresolved state):
   * the version must be a draft, have at least one item, and its deterministic
   * totals must be recomputable and match a finite total. The status change and
   * the quote_sent audit event are written atomically by the repository.
   */
  async sendQuoteVersion(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    actorUserId: UserId,
    companySnapshot: CompanySnapshot,
  ): Promise<void> {
    const found = await this.repository.getVersion(organizationId, versionId);
    if (!found) throw new QuoteVersionNotFoundError();

    const version = found.version;
    if (version.status !== "draft") {
      throw new QuoteNotSendableError("Doar o schiță poate fi trimisă.");
    }
    if (version.items.length === 0) {
      throw new QuoteNotSendableError(
        "Devizul trebuie să conțină cel puțin o lucrare.",
      );
    }

    // Recompute totals from the saved items to confirm the document is valid.
    // This never trusts stored totals blindly and never looks at AI state.
    const computed = computeTotals({
      lines: version.items.map((item) => ({
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discountPct: item.discountPct,
      })),
      quoteDiscountPct: version.discountPct,
      vatRate: version.vatRate,
    });

    const total = new Decimal(computed.total);
    if (!total.isFinite()) {
      throw new QuoteNotSendableError(
        "Totalul devizului nu poate fi calculat.",
      );
    }

    // Freeze the validity end date now so the document never shifts later.
    let validUntil: Date | null = null;
    if (version.validityDays != null && version.validityDays > 0) {
      validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + version.validityDays);
    }

    await this.repository.markVersionSent(
      organizationId,
      versionId,
      actorUserId,
      companySnapshot,
      validUntil,
    );
  }

  /**
   * Creates a NEW draft version by cloning a sent/rejected version's snapshot
   * and items. The source version stays immutable forever. Returns the new
   * draft version id so callers can redirect into the editor.
   */
  async createDraftFromVersion(
    organizationId: OrganizationId,
    sourceVersionId: QuoteVersionId,
  ): Promise<QuoteVersionId> {
    const found = await this.repository.getVersion(
      organizationId,
      sourceVersionId,
    );
    if (!found) throw new QuoteVersionNotFoundError();

    // Only frozen-but-reworkable versions can spawn a new draft. Accepted
    // versions are view-only; drafts are edited in place.
    if (found.version.status !== "sent" && found.version.status !== "rejected") {
      throw new QuoteVersionNotCloneableError();
    }

    return this.repository.createDraftFromVersion(
      organizationId,
      sourceVersionId,
    );
  }
}
