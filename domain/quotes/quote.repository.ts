import type {
  OrganizationId,
  ProjectId,
  QuoteId,
  QuoteStatus,
  QuoteVersionId,
  SupportedUnit,
  UserId,
} from "@/domain/shared/types";

/**
 * A quote is a container that groups versions. It carries the live project
 * relation for navigation only; document data lives on the version snapshot.
 */
export interface Quote {
  id: QuoteId;
  organizationId: OrganizationId;
  projectId: ProjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

// One line on a version. All these fields are snapshots taken at add time.
export interface QuoteItem {
  id: string;
  sortOrder: number;
  catalogItemId: string | null;
  name: string;
  description: string | null;
  unit: SupportedUnit;
  unitPrice: string;
  quantity: string;
  discountPct: string;
  lineTotal: string;
}

// A version is the source of truth. Money fields are fixed-2 strings (NUMERIC).
export interface QuoteVersion {
  id: QuoteVersionId;
  quoteId: QuoteId;
  organizationId: OrganizationId;
  versionNumber: number;
  status: QuoteStatus;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  projectName: string | null;
  projectAddress: string | null;
  // Company/document metadata frozen at finalize time (NULL for drafts).
  companyName: string | null;
  companyLegalName: string | null;
  companyTaxVatId: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  companyCountry: string | null;
  documentLanguage: string | null;
  paymentTerms: string | null;
  executionDuration: string | null;
  inclusions: string | null;
  exclusions: string | null;
  companyTerms: string | null;
  sentAt: Date | null;
  validUntil: Date | null;
  notes: string | null;
  validityDays: number | null;
  discountPct: string;
  vatRate: string;
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  vatAmount: string;
  total: string;
  items: QuoteItem[];
  createdAt: Date;
  updatedAt: Date;
}

// A version with its parent quote, as needed by view/edit pages.
export interface QuoteWithVersion {
  quote: Quote;
  version: QuoteVersion;
}

// Snapshot fields captured when a quote is created, so later edits to the
// Customer/Project records never change an existing version.
export interface QuoteSnapshot {
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  projectName?: string | null;
  projectAddress?: string | null;
}

// Company/document metadata frozen onto a version when it is finalized (sent).
// Captured from the live organization at send time so the customer-facing
// document never changes if org settings are edited afterwards.
export interface CompanySnapshot {
  companyName: string;
  companyLegalName: string | null;
  companyTaxVatId: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  companyCountry: string | null;
  documentLanguage: string;
  paymentTerms: string | null;
  executionDuration: string | null;
  inclusions: string | null;
  exclusions: string | null;
  companyTerms: string | null;
}

// Data to create a new quote plus its first draft version.
export interface CreateQuoteData {
  projectId?: string | null;
  currency: string;
  vatRate: string;
  snapshot: QuoteSnapshot;
}

// One line as submitted by the editor before pricing/persisting.
export interface QuoteItemInput {
  catalogItemId?: string | null;
  name: string;
  description?: string | null;
  unit: SupportedUnit;
  unitPrice: string;
  quantity: string;
  discountPct?: string | null;
}

// The editable fields of a draft version.
export interface DraftUpdate {
  notes?: string | null;
  validityDays?: number | null;
  discountPct: string;
  items: QuoteItemInput[];
}

// A quote summary row for the project detail list.
export interface QuoteSummary {
  quoteId: QuoteId;
  versionId: QuoteVersionId;
  versionNumber: number;
  status: QuoteStatus;
  currency: string;
  total: string;
  updatedAt: Date;
}

// One currency's aggregated total within a project. Amounts in different
// currencies are NEVER numerically combined (no FX in the commercial domain).
export interface ProjectCurrencyTotal {
  currency: string;
  total: string;
}

// Aggregated quote figures for a project, shown on the projects list. Totals
// are broken down per currency; more than one entry means the project mixes
// currencies and a single combined total is intentionally not available.
export interface ProjectQuoteSummary {
  projectId: ProjectId;
  quoteCount: number;
  totals: ProjectCurrencyTotal[];
}

/**
 * Port owned by the domain. The infrastructure layer implements it with Drizzle.
 */
export interface QuoteRepository {
  // Creates a quote and its version 1 (empty draft) atomically.
  createQuoteWithFirstVersion(
    organizationId: OrganizationId,
    data: CreateQuoteData,
  ): Promise<QuoteWithVersion>;

  // Loads a version with its items, scoped to the organization.
  getVersion(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
  ): Promise<QuoteWithVersion | null>;

  // Loads the latest version id for a quote (highest version_number).
  getLatestVersionId(
    organizationId: OrganizationId,
    quoteId: QuoteId,
  ): Promise<QuoteVersionId | null>;

  // Replaces a draft version's editable fields, items and computed totals.
  saveDraft(
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
  ): Promise<void>;

  // Lists quote summaries for a project (latest version per quote).
  listByProject(
    organizationId: OrganizationId,
    projectId: ProjectId,
  ): Promise<QuoteSummary[]>;

  // Lists ALL versions in the given statuses for a project (not only latest).
  listByProjectStatuses(
    organizationId: OrganizationId,
    projectId: ProjectId,
    statuses: QuoteStatus[],
  ): Promise<QuoteSummary[]>;

  // Freezes a draft version as 'sent' and records a quote_sent audit event in
  // the SAME transaction. Also freezes the company/document snapshot, sent_at
  // and valid_until onto the version. Throws if missing or not a draft.
  markVersionSent(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    actorUserId: UserId,
    snapshot: CompanySnapshot,
    validUntil: Date | null,
  ): Promise<void>;

  // Clones a source version's snapshot + items into a NEW draft version whose
  // number is (max version number for the quote) + 1. The source is untouched.
  // Returns the new draft version id.
  createDraftFromVersion(
    organizationId: OrganizationId,
    sourceVersionId: QuoteVersionId,
  ): Promise<QuoteVersionId>;

  // Aggregated quote figures per project across the whole organization.
  listProjectQuoteSummaries(
    organizationId: OrganizationId,
  ): Promise<ProjectQuoteSummary[]>;

  // Deletes a quote container and all dependent rows via DB cascades.
  deleteQuote(organizationId: OrganizationId, quoteId: QuoteId): Promise<void>;
}
