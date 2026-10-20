import assert from "node:assert/strict";
import {
  calculateProfessionalGeneralEstimate,
  ProfessionalGeneralEstimateAggregationError,
  PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS,
} from "../domain/professional-estimates/calculation";
import {
  ProfessionalGeneralEstimateService,
  ProfessionalGeneralEstimateNotFoundError,
  ProfessionalGeneralEstimateValidationError,
  ProfessionalGeneralEstimateSourceNotFoundError,
} from "../domain/professional-estimates/professional-general-estimate.service";
import type {
  ProfessionalGeneralEstimateEntryRecord,
  ProfessionalGeneralEstimateRecord,
  ProfessionalGeneralEstimateRepository,
  ProfessionalGeneralEstimateSummaryRecord,
} from "../domain/professional-estimates/professional-general-estimate.repository";
import {
  ProfessionalObjectEstimateNotFoundError,
  type ProfessionalObjectEstimateListItem,
  type ProfessionalObjectEstimateView,
} from "../domain/professional-estimates/professional-object-estimate.service";

const ids = {
  organization: "10000000-0000-4000-8000-000000000001",
  otherOrganization: "10000000-0000-4000-8000-000000000002",
  general: "20000000-0000-4000-8000-000000000001",
  sourceA: "30000000-0000-4000-8000-000000000001",
  sourceB: "30000000-0000-4000-8000-000000000002",
  sourceC: "30000000-0000-4000-8000-000000000003",
  entryA: "40000000-0000-4000-8000-000000000001",
  entryB: "40000000-0000-4000-8000-000000000002",
  entryC: "40000000-0000-4000-8000-000000000003",
};
const date = "2026-10-15";

function aggregationEntry(
  objectEstimateId: string,
  chapterNumber: number,
  values: {
    constructionWorks: string;
    installationWorks?: string;
    equipmentFurnitureInventory?: string;
    otherCosts?: string;
    currency?: "MDL" | "EUR";
  },
) {
  return {
    objectEstimateId,
    chapterNumber,
    constructionWorks: values.constructionWorks,
    installationWorks: values.installationWorks ?? "0",
    equipmentFurnitureInventory: values.equipmentFurnitureInventory ?? "0",
    otherCosts: values.otherCosts ?? "0",
    currency: values.currency ?? "MDL",
  } as const;
}

const totals = calculateProfessionalGeneralEstimate([
  aggregationEntry(ids.sourceA, 2, { constructionWorks: "5051.2539" }),
  aggregationEntry(ids.sourceB, 2, {
    constructionWorks: "1000.1",
    installationWorks: "250.25",
    equipmentFurnitureInventory: "50.005",
    otherCosts: "10",
  }),
  aggregationEntry(ids.sourceC, 7, {
    constructionWorks: "500",
    otherCosts: "20.2",
  }),
]);
assert.deepEqual(totals.chapters[2], {
  constructionWorks: "6051.3539",
  installationWorks: "250.25",
  equipmentFurnitureInventory: "50.005",
  otherCosts: "10",
  total: "6361.6089",
});
assert.deepEqual(totals.chapters[7], {
  constructionWorks: "500",
  installationWorks: "0",
  equipmentFurnitureInventory: "0",
  otherCosts: "20.2",
  total: "520.2",
});
assert.deepEqual(totals.totals, {
  constructionWorks: "6551.3539",
  installationWorks: "250.25",
  equipmentFurnitureInventory: "50.005",
  otherCosts: "30.2",
  total: "6881.8089",
});
assert.deepEqual(totals.chapters[1], {
  constructionWorks: "0",
  installationWorks: "0",
  equipmentFurnitureInventory: "0",
  otherCosts: "0",
  total: "0",
});
assert.throws(
  () =>
    calculateProfessionalGeneralEstimate([
      aggregationEntry(ids.sourceA, 2, { constructionWorks: "1" }),
      aggregationEntry(ids.sourceB, 2, {
        constructionWorks: "1",
        currency: "EUR",
      }),
    ]),
  ProfessionalGeneralEstimateAggregationError,
);
for (const chapterNumber of [0, 13, 1.5]) {
  assert.throws(
    () =>
      calculateProfessionalGeneralEstimate([
        aggregationEntry(ids.sourceA, chapterNumber, {
          constructionWorks: "1",
        }),
      ]),
    ProfessionalGeneralEstimateAggregationError,
  );
}
assert.throws(
  () =>
    calculateProfessionalGeneralEstimate([
      aggregationEntry(ids.sourceA, 2, { constructionWorks: "1" }),
      aggregationEntry(ids.sourceA, 3, { constructionWorks: "1" }),
    ]),
  /only once/,
);

function source(
  id: string,
  options: {
    complete?: boolean;
    date?: string;
    currency?: "MDL" | "EUR";
    amount?: string;
  } = {},
): ProfessionalObjectEstimateView {
  const complete = options.complete ?? true;
  const amount = options.amount ?? "10";
  const categoryTotals = {
    currency: options.currency ?? "MDL",
    constructionWorks: amount,
    installationWorks: "0",
    equipmentFurnitureInventory: "0",
    otherCosts: "0",
    total: amount,
  };
  return {
    id,
    constructionObjectId: `50000000-0000-4000-8000-${id.slice(-12)}`,
    constructionObjectName: `Construction ${id.slice(-1)}`,
    name: `Object estimate ${id.slice(-1)}`,
    code: null,
    valuationDate: options.date ?? date,
    currency: options.currency ?? "MDL",
    notes: null,
    entries: [],
    candidates: [],
    complete,
    totals: complete ? categoryTotals : null,
    includedCount: complete ? 1 : 0,
  };
}

function sourceListItem(
  view: ProfessionalObjectEstimateView,
): ProfessionalObjectEstimateListItem {
  return {
    id: view.id,
    constructionObjectId: view.constructionObjectId,
    constructionObjectName: view.constructionObjectName,
    name: view.name,
    valuationDate: view.valuationDate,
    currency: view.currency,
    includedCount: view.includedCount,
    complete: view.complete,
    total: view.totals?.total ?? null,
  };
}

function makeFixture() {
  const estimate: ProfessionalGeneralEstimateRecord = {
    id: ids.general,
    organizationId: ids.organization,
    name: "General estimate",
    code: null,
    valuationDate: date,
    currency: "MDL",
    notes: null,
    createdAt: new Date(`${date}T00:00:00Z`),
    updatedAt: new Date(`${date}T00:00:00Z`),
  };
  const entries: ProfessionalGeneralEstimateEntryRecord[] = [];
  const sources = new Map<string, ProfessionalObjectEstimateView>([
    [ids.sourceA, source(ids.sourceA, { amount: "5051.2539" })],
    [ids.sourceB, source(ids.sourceB, { amount: "1000.1" })],
    [ids.sourceC, source(ids.sourceC, { amount: "500" })],
  ]);
  const row = (): ProfessionalGeneralEstimateSummaryRecord => ({
    estimate,
    entries: [...entries],
  });
  const repository: ProfessionalGeneralEstimateRepository = {
    async list(orgId) {
      return orgId === ids.organization ? [row()] : [];
    },
    async get(orgId, id) {
      return orgId === ids.organization && id === ids.general ? row() : null;
    },
    async create(_orgId, data) {
      estimate.name = data.name;
      estimate.code = data.code ?? null;
      estimate.valuationDate = data.valuationDate;
      estimate.currency = data.currency;
      estimate.notes = data.notes ?? null;
      return estimate.id;
    },
    async addEntry(orgId, generalId, sourceId, chapterNumber) {
      if (orgId !== ids.organization || generalId !== estimate.id) return false;
      if (entries.some((entry) => entry.objectEstimateId === sourceId)) {
        throw new Error("Object estimate is already associated.");
      }
      const chapterPositionNumber =
        Math.max(
          0,
          ...entries
            .filter((entry) => entry.chapterNumber === chapterNumber)
            .map((entry) => entry.chapterPositionNumber),
        ) + 1;
      entries.push({
        id: `60000000-0000-4000-8000-${String(entries.length + 1).padStart(12, "0")}`,
        organizationId: orgId,
        generalEstimateId: generalId,
        objectEstimateId: sourceId,
        chapterNumber,
        chapterPositionNumber,
        included: true,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return true;
    },
    async updateEntry(orgId, generalId, entryId, data) {
      const entry = entries.find(
        (candidate) =>
          candidate.organizationId === orgId &&
          candidate.generalEstimateId === generalId &&
          candidate.id === entryId,
      );
      if (!entry) return false;
      if (data.included !== undefined) entry.included = data.included;
      if (
        data.chapterNumber !== undefined &&
        data.chapterNumber !== entry.chapterNumber
      ) {
        const nextPosition =
          Math.max(
            0,
            ...entries
              .filter(
                (candidate) =>
                  candidate.id !== entryId &&
                  candidate.chapterNumber === data.chapterNumber,
              )
              .map((candidate) => candidate.chapterPositionNumber),
          ) + 1;
        entry.chapterNumber = data.chapterNumber;
        entry.chapterPositionNumber = nextPosition;
      }
      return true;
    },
  };
  const objectEstimateService = {
    async list(orgId: string) {
      return orgId === ids.organization
        ? [...sources.values()].map(sourceListItem)
        : [];
    },
    async get(orgId: string, id: string) {
      const found = orgId === ids.organization ? sources.get(id) : undefined;
      if (!found) throw new ProfessionalObjectEstimateNotFoundError();
      return found;
    },
  };
  const service = new ProfessionalGeneralEstimateService(
    repository,
    objectEstimateService,
  );
  return { service, entries, sources };
}

async function runServiceTests() {
const { service, entries, sources } = makeFixture();
const generalId = await service.create(ids.organization, {
  name: "  General estimate  ",
  valuationDate: date,
  currency: "MDL",
});
assert.equal(generalId, ids.general);
let detail = await service.get(ids.organization, ids.general);
assert.equal(detail.complete, false, "an empty estimate is incomplete");
assert.equal(detail.totals, null);
assert.equal(detail.candidates.length, 3);

await service.addEntry(ids.organization, ids.general, ids.sourceA, 2);
assert.equal(entries[0]?.chapterNumber, 2);
assert.equal(entries[0]?.chapterPositionNumber, 1);
assert.equal((await service.get(ids.organization, ids.general)).totals?.totals.total, "5051.2539");
await service.addEntry(ids.organization, ids.general, ids.sourceB, 2);
await service.addEntry(ids.organization, ids.general, ids.sourceC, 7);
detail = await service.get(ids.organization, ids.general);
assert.equal(detail.totals?.chapters[2].total, "6051.3539");
assert.equal(detail.totals?.chapters[7].total, "500");

const stableEntryId = entries[0]!.id;
await service.updateEntry(ids.organization, ids.general, stableEntryId, {
  chapterNumber: 7,
});
assert.equal(entries[0]!.id, stableEntryId, "chapter move preserves entry identity");
assert.equal(entries[0]!.chapterNumber, 7);
assert.equal(entries[0]!.chapterPositionNumber, 2);
await service.updateEntry(ids.organization, ids.general, stableEntryId, {
  chapterNumber: 2,
});
assert.equal(entries[0]!.chapterNumber, 2);
assert.equal(
  entries[0]!.chapterPositionNumber,
  3,
  "moving back allocates the next chapter-local row without renumbering",
);
assert.equal(
  (await service.get(ids.organization, ids.general)).totals?.totals.total,
  "6551.3539",
);

const incompleteSource = source("30000000-0000-4000-8000-000000000004", {
  complete: false,
});
sources.set(incompleteSource.id, incompleteSource);
await service.addEntry(ids.organization, ids.general, incompleteSource.id, 9);
assert.equal(
  (await service.get(ids.organization, ids.general)).complete,
  false,
  "an included incomplete source blocks completion",
);
const incompleteEntry = entries.find(
  (entry) => entry.objectEstimateId === incompleteSource.id,
)!;
await service.updateEntry(ids.organization, ids.general, incompleteEntry.id, {
  included: false,
});
assert.equal(
  (await service.get(ids.organization, ids.general)).complete,
  true,
  "an excluded incomplete source does not block completion",
);
assert.equal(
  (await service.get(ids.organization, ids.general)).totals?.totals.total,
  "6551.3539",
  "excluded entries do not contribute to totals",
);
await service.updateEntry(ids.organization, ids.general, incompleteEntry.id, {
  included: true,
});
assert.equal(
  (await service.get(ids.organization, ids.general)).totals,
  null,
  "included incomplete totals are never treated as zero",
);
await service.updateEntry(ids.organization, ids.general, incompleteEntry.id, {
  included: false,
});

const originalChapterSource = sources.get(ids.sourceC)!;
sources.set(ids.sourceC, source(ids.sourceC, { date: "2026-10-16" }));
assert.equal(
  (await service.get(ids.organization, ids.general)).totals,
  null,
  "a live source with a different valuation date blocks totals",
);
sources.set(ids.sourceC, source(ids.sourceC, { currency: "EUR" }));
assert.equal(
  (await service.get(ids.organization, ids.general)).totals,
  null,
  "a live source with a different currency blocks totals",
);
sources.set(ids.sourceC, originalChapterSource);

const originalSource = sources.get(ids.sourceA)!;
sources.set(ids.sourceA, source(ids.sourceA, { complete: false }));
assert.equal(
  (await service.get(ids.organization, ids.general)).complete,
  false,
  "live source changes invalidate the aggregate",
);
sources.set(ids.sourceA, originalSource);
assert.equal(
  (await service.get(ids.organization, ids.general)).totals?.totals.total,
  "6551.3539",
  "restoring a live source restores the current subtotal without relinking",
);

await assert.rejects(
  service.addEntry(ids.organization, ids.general, ids.sourceA, 1),
  /already associated/,
);
await assert.rejects(
  service.addEntry(ids.organization, ids.general, ids.sourceA, 0),
  ProfessionalGeneralEstimateValidationError,
);
await assert.rejects(
  service.addEntry(ids.organization, ids.general, ids.sourceA, 13),
  ProfessionalGeneralEstimateValidationError,
);
await assert.rejects(
  service.addEntry(ids.organization, ids.general, ids.sourceB, 2),
  /already associated/,
);
await assert.rejects(
  service.addEntry(ids.otherOrganization, ids.general, ids.sourceA, 2),
  ProfessionalGeneralEstimateNotFoundError,
);
sources.set(ids.sourceC, source(ids.sourceC, { date: "2026-10-16" }));
await assert.rejects(
  service.addEntry(ids.organization, ids.general, ids.sourceC, 2),
  ProfessionalGeneralEstimateValidationError,
);
sources.set(ids.sourceC, source(ids.sourceC, { currency: "EUR" }));
await assert.rejects(
  service.addEntry(ids.organization, ids.general, ids.sourceC, 2),
  ProfessionalGeneralEstimateValidationError,
);
sources.delete(ids.sourceC);
await assert.rejects(
  service.addEntry(ids.organization, ids.general, ids.sourceC, 2),
  ProfessionalGeneralEstimateSourceNotFoundError,
);
await assert.rejects(
  service.create(ids.organization, {
    name: "Invalid date",
    valuationDate: "2026-02-30",
    currency: "MDL",
  }),
  ProfessionalGeneralEstimateValidationError,
);
assert.equal(PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.length, 12);
}

runServiceTests()
  .then(() => console.log("Professional general estimate domain tests passed."))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
