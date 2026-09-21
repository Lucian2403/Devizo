/**
 * Lifecycle tests for M6.1 (send + immutable quote version lifecycle). No test
 * framework is installed, so this runs as a plain script via tsx and exits
 * non-zero on failure. Run with:  npx --yes pnpm@9.12.0 test:quotes
 *
 * It uses an in-memory QuoteRepository so it needs no database, and exercises
 * the real QuoteService rules that guard the lifecycle. The DB-level trigger
 * guard (accidental direct mutation of frozen rows) is verified separately by
 * asserting the immutability policy file is present.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QuoteService,
  QuoteNotEditableError,
  QuoteNotSendableError,
  QuoteVersionNotCloneableError,
} from "../domain/quotes/quote.service";
import { computeTotals } from "../domain/quotes/pricing";
import { aggregateProjectQuoteSummaries } from "../domain/quotes/project-summary";
import { buildQuoteDocumentNumber } from "../lib/quotes/document-number";
import { CURRENT_COMMERCIAL_OFFER_PDF_TEMPLATE_VERSION } from "../domain/quotes/pdf-template-version";
import type {
  CompanySnapshot,
  CreateQuoteData,
  DraftUpdate,
  ProjectQuoteSummary,
  Quote,
  QuoteItem,
  QuoteRepository,
  QuoteSummary,
  QuoteVersion,
  QuoteWithVersion,
} from "../domain/quotes/quote.repository";
import type {
  CustomerId,
  OrganizationId,
  ProjectId,
  QuoteId,
  QuoteStatus,
  QuoteVersionId,
  UserId,
} from "../domain/shared/types";

let passed = 0;
async function atest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok - ${name}`);
  } catch (error) {
    console.error(`  FAIL - ${name}`);
    console.error(error);
    process.exit(1);
  }
}

// --- Minimal in-memory repository ------------------------------------------

let idCounter = 0;
const nextId = () => `id-${++idCounter}`;

interface StoredVersion extends Omit<QuoteVersion, "items"> {}

interface FakeLiveSource {
  projectName: string;
  projectAddress: string | null;
  customerId: CustomerId | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
}

class FakeQuoteRepository implements QuoteRepository {
  quotes: Quote[] = [];
  versions: StoredVersion[] = [];
  items = new Map<QuoteVersionId, QuoteItem[]>();
  liveSources = new Map<ProjectId, FakeLiveSource>();
  audit: {
    organizationId: string;
    quoteId: string;
    quoteVersionId: string;
    actorUserId: string;
    eventType: string;
  }[] = [];

  private assembleVersion(v: StoredVersion): QuoteVersion {
    return { ...v, items: this.items.get(v.id) ?? [] };
  }

  setLiveSource(projectId: ProjectId, source: FakeLiveSource) {
    this.liveSources.set(projectId, source);
  }

  async createQuoteWithFirstVersion(
    organizationId: OrganizationId,
    data: CreateQuoteData,
  ): Promise<QuoteWithVersion> {
    const now = new Date();
    const quote: Quote = {
      id: nextId(),
      organizationId,
      projectId: data.projectId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.quotes.push(quote);
    const version: StoredVersion = {
      id: nextId(),
      quoteId: quote.id,
      organizationId,
      versionNumber: 1,
      status: "draft",
      currency: data.currency,
      customerName: data.snapshot.customerName ?? null,
      customerEmail: data.snapshot.customerEmail ?? null,
      customerPhone: data.snapshot.customerPhone ?? null,
      projectName: data.snapshot.projectName ?? null,
      projectAddress: data.snapshot.projectAddress ?? null,
      snapshotCapturedAt: null,
      sourceProjectId: null,
      sourceCustomerId: null,
      documentNumber: null,
      documentYear: null,
      documentSequence: null,
      pdfTemplateVersion: null,
      companyName: null,
      companyLegalName: null,
      companyTaxVatId: null,
      companyEmail: null,
      companyPhone: null,
      companyAddress: null,
      companyCountry: null,
      documentLanguage: null,
      paymentTerms: null,
      executionDuration: null,
      inclusions: null,
      exclusions: null,
      companyTerms: null,
      sentAt: null,
      validUntil: null,
      notes: null,
      validityDays: null,
      discountPct: "0",
      vatRate: data.vatRate,
      subtotal: "0",
      discountAmount: "0",
      taxableAmount: "0",
      vatAmount: "0",
      total: "0",
      createdAt: now,
      updatedAt: now,
    };
    this.versions.push(version);
    this.items.set(version.id, []);
    return { quote, version: this.assembleVersion(version) };
  }

  async getVersion(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
  ): Promise<QuoteWithVersion | null> {
    const version = this.versions.find(
      (v) => v.organizationId === organizationId && v.id === versionId,
    );
    if (!version) return null;
    const quote = this.quotes.find((q) => q.id === version.quoteId);
    if (!quote) return null;
    return { quote, version: this.assembleVersion(version) };
  }

  async getLatestVersionId(
    organizationId: OrganizationId,
    quoteId: QuoteId,
  ): Promise<QuoteVersionId | null> {
    const list = this.versions
      .filter((v) => v.organizationId === organizationId && v.quoteId === quoteId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return list[0]?.id ?? null;
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
    const version = this.versions.find(
      (v) => v.organizationId === organizationId && v.id === versionId,
    );
    if (!version) throw new Error("not found");
    if (version.status !== "draft") throw new Error("frozen");

    this.items.set(
      versionId,
      update.items.map((item, index) => ({
        id: nextId(),
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
    version.notes = update.notes ?? null;
    version.validityDays = update.validityDays ?? null;
    version.discountPct = update.discountPct;
    version.subtotal = computed.subtotal;
    version.discountAmount = computed.discountAmount;
    version.taxableAmount = computed.taxableAmount;
    version.vatAmount = computed.vatAmount;
    version.total = computed.total;
    version.updatedAt = new Date();
  }

  async markVersionSent(
    organizationId: OrganizationId,
    versionId: QuoteVersionId,
    actorUserId: UserId,
    snapshot: CompanySnapshot,
    validUntil: Date | null,
  ): Promise<void> {
    const version = this.versions.find(
      (v) => v.organizationId === organizationId && v.id === versionId,
    );
    if (!version) throw new Error("not found");
    if (version.status !== "draft") throw new Error("Only draft can be sent.");

    const now = new Date();
    const documentYear = now.getUTCFullYear();
    const quote = this.quotes.find((q) => q.id === version.quoteId);
    const liveSource = quote?.projectId
      ? this.liveSources.get(quote.projectId)
      : undefined;
    const latestSequence = this.versions
      .filter(
        (v) =>
          v.organizationId === organizationId &&
          v.documentYear === documentYear &&
          v.documentSequence != null,
      )
      .reduce((latest, v) => Math.max(latest, v.documentSequence ?? 0), 0);
    const documentSequence = latestSequence + 1;

    version.status = "sent";
    version.documentYear = documentYear;
    version.documentSequence = documentSequence;
    version.documentNumber = `DEV-${documentYear}-${String(documentSequence).padStart(6, "0")}`;
    version.pdfTemplateVersion = CURRENT_COMMERCIAL_OFFER_PDF_TEMPLATE_VERSION;
    version.snapshotCapturedAt = now;
    version.sourceProjectId = quote?.projectId ?? null;
    version.sourceCustomerId = liveSource?.customerId ?? null;
    if (liveSource) {
      version.projectName = liveSource.projectName;
      version.projectAddress = liveSource.projectAddress;
      version.customerName = liveSource.customerName;
      version.customerEmail = liveSource.customerEmail;
      version.customerPhone = liveSource.customerPhone;
    }
    version.companyName = snapshot.companyName;
    version.companyLegalName = snapshot.companyLegalName;
    version.companyTaxVatId = snapshot.companyTaxVatId;
    version.companyEmail = snapshot.companyEmail;
    version.companyPhone = snapshot.companyPhone;
    version.companyAddress = snapshot.companyAddress;
    version.companyCountry = snapshot.companyCountry;
    version.documentLanguage = snapshot.documentLanguage;
    version.paymentTerms = snapshot.paymentTerms;
    version.executionDuration = snapshot.executionDuration;
    version.inclusions = snapshot.inclusions;
    version.exclusions = snapshot.exclusions;
    version.companyTerms = snapshot.companyTerms;
    version.sentAt = now;
    version.validUntil = validUntil;
    version.updatedAt = now;
    this.audit.push({
      organizationId,
      quoteId: version.quoteId,
      quoteVersionId: versionId,
      actorUserId,
      eventType: "quote_sent",
    });
  }

  async createDraftFromVersion(
    organizationId: OrganizationId,
    sourceVersionId: QuoteVersionId,
  ): Promise<QuoteVersionId> {
    const source = this.versions.find(
      (v) => v.organizationId === organizationId && v.id === sourceVersionId,
    );
    if (!source) throw new Error("not found");
    const maxNumber = Math.max(
      ...this.versions
        .filter((v) => v.quoteId === source.quoteId)
        .map((v) => v.versionNumber),
    );
    const clone: StoredVersion = {
      ...source,
      id: nextId(),
      versionNumber: maxNumber + 1,
      status: "draft",
      documentNumber: null,
      documentYear: null,
      documentSequence: null,
      pdfTemplateVersion: null,
      snapshotCapturedAt: null,
      sourceProjectId: null,
      sourceCustomerId: null,
      companyName: null,
      companyLegalName: null,
      companyTaxVatId: null,
      companyEmail: null,
      companyPhone: null,
      companyAddress: null,
      companyCountry: null,
      documentLanguage: null,
      paymentTerms: null,
      executionDuration: null,
      inclusions: null,
      exclusions: null,
      companyTerms: null,
      sentAt: null,
      validUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.versions.push(clone);
    this.items.set(
      clone.id,
      (this.items.get(sourceVersionId) ?? []).map((item) => ({
        ...item,
        id: nextId(),
      })),
    );
    return clone.id;
  }

  async listByProject(): Promise<QuoteSummary[]> {
    return [];
  }
  async listByProjectStatuses(
    _organizationId: OrganizationId,
    _projectId: ProjectId,
    _statuses: QuoteStatus[],
  ): Promise<QuoteSummary[]> {
    return [];
  }
  async listProjectQuoteSummaries(): Promise<ProjectQuoteSummary[]> {
    return [];
  }
  async deleteQuote(
    _organizationId: OrganizationId,
    _quoteId: QuoteId,
  ): Promise<void> {}
}

// --- Helpers ---------------------------------------------------------------

const ORG: OrganizationId = "org-1";
const USER: UserId = "user-1";

const SNAP: CompanySnapshot = {
  companyName: "Acme SRL",
  companyLegalName: "Acme Construcții SRL",
  companyTaxVatId: "VAT-123",
  companyEmail: "office@acme.example",
  companyPhone: "+373 60 000000",
  companyAddress: "Str. Exemplu 1",
  companyCountry: "MD",
  documentLanguage: "ro",
  paymentTerms: "40% avans, 60% la final",
  executionDuration: "10-14 zile lucrătoare",
  inclusions: "Manoperă + consumabile",
  exclusions: "Materiale decorative premium",
  companyTerms: "Oferta este valabilă în limita stocului.",
};

function priced(items: { unitPrice: string; quantity: string }[]) {
  return computeTotals({
    lines: items.map((i) => ({ ...i, discountPct: "0" })),
    quoteDiscountPct: "0",
    vatRate: "20",
  });
}

async function seedDraftWithItems(
  repo: FakeQuoteRepository,
  service: QuoteService,
) {
  const created = await service.createQuote(ORG, {
    currency: "MDL",
    vatRate: "20",
    snapshot: { customerName: "Ion", projectName: "Baie" },
  } as CreateQuoteData);
  const versionId = created.version.id;
  await service.saveDraft(ORG, versionId, {
    discountPct: "0",
    items: [
      { name: "Demolare", unit: "m2", unitPrice: "18.00", quantity: "10" },
    ],
  } as DraftUpdate);
  return { quoteId: created.quote.id, versionId };
}

// --- Tests -----------------------------------------------------------------

async function run() {
  console.log("M6.1 / M7.3 / M7.4 / M7.6 quote lifecycle:");

  await atest("A: a draft version can be edited (saveDraft succeeds)", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    const found = await service.getVersion(ORG, versionId);
    assert.equal(found.version.items.length, 1);
    assert.equal(
      found.version.total,
      priced([{ unitPrice: "18.00", quantity: "10" }]).total,
    );
    assert.equal(found.version.documentNumber, null);
    assert.equal(found.version.pdfTemplateVersion, null);
    assert.equal(found.version.snapshotCapturedAt, null);
    assert.equal(buildQuoteDocumentNumber(found.version), "—");
  });

  await atest("B: a valid draft can be sent and gets an official identity", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    const found = await service.getVersion(ORG, versionId);
    assert.equal(found.version.status, "sent");
    assert.match(found.version.documentNumber ?? "", /^DEV-\d{4}-\d{6}$/);
    assert.equal(found.version.documentYear, found.version.sentAt!.getUTCFullYear());
    assert.equal(found.version.documentSequence, 1);
    assert.equal(
      found.version.pdfTemplateVersion,
      CURRENT_COMMERCIAL_OFFER_PDF_TEMPLATE_VERSION,
    );
    assert.ok(found.version.snapshotCapturedAt instanceof Date);
    assert.equal(
      found.version.snapshotCapturedAt?.getTime(),
      found.version.sentAt?.getTime(),
    );
    assert.equal(buildQuoteDocumentNumber(found.version), found.version.documentNumber);
  });

  await atest(
    "B1.1: finalization refreshes live project/customer data and records provenance",
    async () => {
      const repo = new FakeQuoteRepository();
      const service = new QuoteService(repo);
      const projectId = "project-live" as ProjectId;
      const customerId = "customer-live" as CustomerId;

      const created = await service.createQuote(ORG, {
        projectId,
        currency: "MDL",
        vatRate: "20",
        snapshot: {
          projectName: "Nume vechi",
          projectAddress: "Adresa veche",
          customerName: "Client vechi",
          customerEmail: "vechi@example.com",
          customerPhone: "000",
        },
      });
      await service.saveDraft(ORG, created.version.id, {
        discountPct: "0",
        items: [
          { name: "Lucrare", unit: "m2", unitPrice: "10", quantity: "1" },
        ],
      });

      repo.setLiveSource(projectId, {
        projectName: "Nume actual",
        projectAddress: "Adresa actuală",
        customerId,
        customerName: "Client actual",
        customerEmail: "actual@example.com",
        customerPhone: "+37360000000",
      });

      await service.sendQuoteVersion(ORG, created.version.id, USER, SNAP);
      const finalized = (await service.getVersion(ORG, created.version.id)).version;
      assert.equal(finalized.projectName, "Nume actual");
      assert.equal(finalized.projectAddress, "Adresa actuală");
      assert.equal(finalized.customerName, "Client actual");
      assert.equal(finalized.customerEmail, "actual@example.com");
      assert.equal(finalized.sourceProjectId, projectId);
      assert.equal(finalized.sourceCustomerId, customerId);
      assert.ok(finalized.snapshotCapturedAt instanceof Date);
      assert.equal(
        finalized.snapshotCapturedAt?.getTime(),
        finalized.sentAt?.getTime(),
      );

      repo.setLiveSource(projectId, {
        projectName: "Schimbat după trimitere",
        projectAddress: "Altă adresă",
        customerId,
        customerName: "Alt client",
        customerEmail: null,
        customerPhone: null,
      });
      const stillFrozen = (await service.getVersion(ORG, created.version.id)).version;
      assert.equal(stillFrozen.projectName, "Nume actual");
      assert.equal(stillFrozen.customerName, "Client actual");
    },
  );

  await atest("B2: sending a version with zero items is blocked", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const created = await service.createQuote(ORG, {
      currency: "MDL",
      vatRate: "20",
      snapshot: {},
    } as CreateQuoteData);
    await assert.rejects(
      () => service.sendQuoteVersion(ORG, created.version.id, USER, SNAP),
      QuoteNotSendableError,
    );
  });

  await atest("B3: document sequences increase within the same organization/year", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const first = await seedDraftWithItems(repo, service);
    const second = await seedDraftWithItems(repo, service);

    await service.sendQuoteVersion(ORG, first.versionId, USER, SNAP);
    await service.sendQuoteVersion(ORG, second.versionId, USER, SNAP);

    const firstVersion = (await service.getVersion(ORG, first.versionId)).version;
    const secondVersion = (await service.getVersion(ORG, second.versionId)).version;
    assert.equal(firstVersion.documentSequence, 1);
    assert.equal(secondVersion.documentSequence, 2);
    assert.notEqual(firstVersion.documentNumber, secondVersion.documentNumber);
  });

  await atest("C: a sent version cannot be edited (saveDraft throws)", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    await assert.rejects(
      () =>
        service.saveDraft(ORG, versionId, {
          discountPct: "0",
          items: [
            { name: "Hack", unit: "m2", unitPrice: "1", quantity: "1" },
          ],
        } as DraftUpdate),
      QuoteNotEditableError,
    );
  });

  await atest("C2: re-sending a sent version is blocked", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    await assert.rejects(
      () => service.sendQuoteVersion(ORG, versionId, USER, SNAP),
      QuoteNotSendableError,
    );
  });

  await atest("D: direct item write on a sent version is blocked", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    await assert.rejects(() =>
      repo.saveDraft(
        ORG,
        versionId,
        { discountPct: "0", items: [] } as DraftUpdate,
        priced([]),
      ),
    );
  });

  await atest("D2: DB immutability trigger policy file is present", () => {
    const policySql = readFileSync(
      join(process.cwd(), "infrastructure/db/policies/0006_quote_immutability.sql"),
      "utf8",
    );
    assert.ok(policySql.includes("quote_versions_immutability"));
    assert.ok(policySql.includes("quote_items_immutability"));
    assert.ok(policySql.includes("audit_events_append_only"));
  });

  await atest("D3: M7.3 migration enforces unique frozen document identity", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "infrastructure/db/migrations/0011_document_identity.sql"),
      "utf8",
    );
    assert.ok(migrationSql.includes("quote_versions_org_document_number_unique"));
    assert.ok(migrationSql.includes("quote_versions_org_document_sequence_unique"));
    assert.ok(migrationSql.includes("quote_versions_document_identity_check"));
    assert.ok(migrationSql.includes("ROW_NUMBER() OVER"));

    const repositorySource = readFileSync(
      join(process.cwd(), "infrastructure/db/repositories/quote.repository.ts"),
      "utf8",
    );
    assert.ok(repositorySource.includes("pg_advisory_xact_lock"));
  });

  await atest("D4: M7.4 migration defines final snapshot provenance", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "infrastructure/db/migrations/0012_snapshot_provenance.sql"),
      "utf8",
    );
    assert.ok(migrationSql.includes("snapshot_captured_at"));
    assert.ok(migrationSql.includes("source_project_id"));
    assert.ok(migrationSql.includes("source_customer_id"));
    assert.ok(migrationSql.includes("quote_versions_snapshot_provenance_check"));
    assert.ok(migrationSql.includes("DROP TRIGGER IF EXISTS quote_versions_immutability"));
  });

  await atest("D5: M7.6 migration freezes the PDF template version", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "infrastructure/db/migrations/0013_pdf_template_version.sql"),
      "utf8",
    );
    assert.ok(migrationSql.includes("pdf_template_version"));
    assert.ok(migrationSql.includes("commercial-offer-v1"));
    assert.ok(migrationSql.includes("quote_versions_pdf_template_version_check"));
    assert.ok(migrationSql.includes("DROP TRIGGER IF EXISTS quote_versions_immutability"));
  });

  await atest("E: create new version clones sent v1 into a v2 draft", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    const newId = await service.createDraftFromVersion(ORG, versionId);
    const v2 = await service.getVersion(ORG, newId);
    assert.equal(v2.version.versionNumber, 2);
    assert.equal(v2.version.status, "draft");
    assert.equal(v2.version.items.length, 1);
    assert.equal(v2.version.items[0]!.name, "Demolare");
    assert.equal(v2.version.documentNumber, null);
    assert.equal(v2.version.documentYear, null);
    assert.equal(v2.version.documentSequence, null);
    assert.equal(v2.version.pdfTemplateVersion, null);
    assert.equal(v2.version.snapshotCapturedAt, null);
    assert.equal(v2.version.sourceProjectId, null);
    assert.equal(v2.version.sourceCustomerId, null);
    assert.equal(v2.version.sentAt, null);
    assert.equal(v2.version.companyName, null);
  });

  await atest("E2: cloning a draft version is rejected", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await assert.rejects(
      () => service.createDraftFromVersion(ORG, versionId),
      QuoteVersionNotCloneableError,
    );
  });

  await atest("F: v1 stays immutable after editing the new v2 draft", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    const originalNumber = (await service.getVersion(ORG, versionId)).version
      .documentNumber;
    const newId = await service.createDraftFromVersion(ORG, versionId);
    await service.saveDraft(ORG, newId, {
      discountPct: "0",
      items: [
        { name: "Zugrăvire", unit: "m2", unitPrice: "11.00", quantity: "30" },
      ],
    } as DraftUpdate);

    const v1 = await service.getVersion(ORG, versionId);
    assert.equal(v1.version.status, "sent");
    assert.equal(v1.version.items.length, 1);
    assert.equal(v1.version.items[0]!.name, "Demolare");
    assert.equal(
      v1.version.total,
      priced([{ unitPrice: "18.00", quantity: "10" }]).total,
    );
    assert.equal(v1.version.documentNumber, originalNumber);

    const v2 = await service.getVersion(ORG, newId);
    assert.equal(v2.version.items[0]!.name, "Zugrăvire");
  });

  await atest("G: sending records exactly one quote_sent audit event", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { quoteId, versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    const events = repo.audit.filter((e) => e.eventType === "quote_sent");
    assert.equal(events.length, 1);
    assert.equal(events[0]!.quoteVersionId, versionId);
    assert.equal(events[0]!.quoteId, quoteId);
    assert.equal(events[0]!.actorUserId, USER);
    assert.equal(events[0]!.organizationId, ORG);
  });

  await atest("H: sending freezes company snapshot, identity and valid_until", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.saveDraft(ORG, versionId, {
      discountPct: "0",
      validityDays: 14,
      items: [
        { name: "Demolare", unit: "m2", unitPrice: "18.00", quantity: "10" },
      ],
    } as DraftUpdate);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);

    const found = await service.getVersion(ORG, versionId);
    const v = found.version;
    assert.equal(v.companyName, SNAP.companyName);
    assert.equal(v.companyTaxVatId, SNAP.companyTaxVatId);
    assert.equal(v.documentLanguage, "ro");
    assert.ok(v.documentNumber);
    assert.ok(v.documentYear);
    assert.ok(v.documentSequence);
    assert.equal(
      v.pdfTemplateVersion,
      CURRENT_COMMERCIAL_OFFER_PDF_TEMPLATE_VERSION,
    );
    assert.ok(v.snapshotCapturedAt instanceof Date);
    assert.ok(v.sentAt instanceof Date);
    assert.equal(v.snapshotCapturedAt?.getTime(), v.sentAt?.getTime());
    assert.ok(v.validUntil instanceof Date);
    const days = Math.round(
      (v.validUntil!.getTime() - v.sentAt!.getTime()) / (24 * 3600 * 1000),
    );
    assert.equal(days, 14);
  });

  await atest("project summaries sum same-currency quotes per project", () => {
    const summaries = aggregateProjectQuoteSummaries([
      { projectId: "p1" as ProjectId, currency: "EUR", total: "100.00" },
      { projectId: "p1" as ProjectId, currency: "EUR", total: "50.00" },
    ]);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]!.quoteCount, 2);
    assert.equal(summaries[0]!.totals.length, 1);
    assert.deepEqual(summaries[0]!.totals[0], {
      currency: "EUR",
      total: "150.00",
    });
  });

  await atest("project summaries never combine different currencies", () => {
    const summaries = aggregateProjectQuoteSummaries([
      { projectId: "p1" as ProjectId, currency: "EUR", total: "100.00" },
      { projectId: "p1" as ProjectId, currency: "MDL", total: "2000.00" },
    ]);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]!.quoteCount, 2);
    assert.equal(summaries[0]!.totals.length, 2);
    assert.deepEqual(summaries[0]!.totals, [
      { currency: "EUR", total: "100.00" },
      { currency: "MDL", total: "2000.00" },
    ]);
  });

  console.log(`\n${passed} checks passed.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
