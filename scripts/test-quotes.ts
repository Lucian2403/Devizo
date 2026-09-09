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

class FakeQuoteRepository implements QuoteRepository {
  quotes: Quote[] = [];
  versions: StoredVersion[] = [];
  items = new Map<QuoteVersionId, QuoteItem[]>();
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
    // DB-level guard analog: never allow item writes on a frozen version.
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
    version.status = "sent";
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
    version.sentAt = new Date();
    version.validUntil = validUntil;
    version.updatedAt = new Date();
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

// A representative company snapshot passed at finalize/send time.
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
  console.log("M6.1 quote lifecycle:");

  // A: draft can be edited
  await atest("A: a draft version can be edited (saveDraft succeeds)", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    const found = await service.getVersion(ORG, versionId);
    assert.equal(found.version.items.length, 1);
    assert.equal(found.version.total, priced([
      { unitPrice: "18.00", quantity: "10" },
    ]).total);
  });

  // B: draft can be sent
  await atest("B: a valid draft can be sent and becomes 'sent'", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    const found = await service.getVersion(ORG, versionId);
    assert.equal(found.version.status, "sent");
  });

  // Send validation: empty quote is blocked.
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

  // C: sent version cannot be edited
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

  // C2: sending an already-sent version is blocked.
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

  // D: direct item mutation on a sent version is blocked (repo-level guard).
  await atest("D: direct item write on a sent version is blocked", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
    // Bypass the service and call the repo directly, as a rogue write would.
    await assert.rejects(() =>
      repo.saveDraft(
        ORG,
        versionId,
        { discountPct: "0", items: [] } as DraftUpdate,
        priced([]),
      ),
    );
  });

  // D2: the database-level immutability guard exists in version control.
  await atest("D2: DB immutability trigger policy file is present", () => {
    const sql = readFileSync(
      join(process.cwd(), "infrastructure/db/policies/0006_quote_immutability.sql"),
      "utf8",
    );
    assert.ok(sql.includes("quote_versions_immutability"));
    assert.ok(sql.includes("quote_items_immutability"));
    assert.ok(sql.includes("audit_events_append_only"));
  });

  // E: "Create new version" clones a sent version into a v2 draft.
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
  });

  // E2: cloning a draft is not allowed (edit it in place instead).
  await atest("E2: cloning a draft version is rejected", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await assert.rejects(
      () => service.createDraftFromVersion(ORG, versionId),
      QuoteVersionNotCloneableError,
    );
  });

  // F: v1 stays unchanged after editing v2.
  await atest("F: v1 stays immutable after editing the new v2 draft", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    await service.sendQuoteVersion(ORG, versionId, USER, SNAP);
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
    assert.equal(v1.version.total, priced([
      { unitPrice: "18.00", quantity: "10" },
    ]).total);

    const v2 = await service.getVersion(ORG, newId);
    assert.equal(v2.version.items[0]!.name, "Zugrăvire");
  });

  // G: a quote_sent audit event is recorded on send.
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

  // H: finalize freezes the company/document snapshot and valid_until.
  await atest("H: sending freezes the company snapshot and valid_until", async () => {
    const repo = new FakeQuoteRepository();
    const service = new QuoteService(repo);
    const { versionId } = await seedDraftWithItems(repo, service);
    // Give the draft a validity window so valid_until can be frozen.
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
    assert.ok(v.sentAt instanceof Date);
    assert.ok(v.validUntil instanceof Date);
    // valid_until must be ~14 days after sent_at.
    const days = Math.round(
      (v.validUntil!.getTime() - v.sentAt!.getTime()) / (24 * 3600 * 1000),
    );
    assert.equal(days, 14);
  });

  console.log(`\n${passed} checks passed.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

