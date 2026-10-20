import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateProfessionalObjectEstimate,
  ProfessionalObjectEstimateAggregationError,
  type ProfessionalObjectEstimateCostCategory,
} from "../domain/professional-estimates/calculation";
import {
  LocalProfessionalEstimateNotFoundError,
  ProfessionalObjectEstimateNotFoundError,
  ProfessionalObjectEstimateService,
  ProfessionalObjectEstimateValidationError,
  type LiveLocalEstimateCalculation,
} from "../domain/professional-estimates/professional-object-estimate.service";
import type {
  ProfessionalObjectEstimateEntryRecord,
  ProfessionalObjectEstimateRecord,
  ProfessionalObjectEstimateRepository,
  ProfessionalObjectEstimateSummaryRecord,
  ProfessionalObjectEstimateWorkspaceRecord,
} from "../domain/professional-estimates/professional-object-estimate.repository";
import type { ProfessionalEstimateSummary } from "../domain/professional-estimates/professional-estimate-workspace.repository";

const ids = {
  organization: "10000000-0000-4000-8000-000000000001",
  anotherOrganization: "10000000-0000-4000-8000-000000000002",
  object: "20000000-0000-4000-8000-000000000001",
  anotherObject: "20000000-0000-4000-8000-000000000002",
  objectEstimate: "30000000-0000-4000-8000-000000000001",
  contextA: "40000000-0000-4000-8000-000000000001",
  contextB: "40000000-0000-4000-8000-000000000002",
  entryA: "50000000-0000-4000-8000-000000000001",
  entryB: "50000000-0000-4000-8000-000000000002",
};

function entry(
  contextId: string,
  category: ProfessionalObjectEstimateCostCategory,
  amount: string,
  currency = "MDL",
) {
  return {
    calculationContextId: contextId,
    costCategory: category,
    amount,
    currency,
  };
}

const totals = calculateProfessionalObjectEstimate([
  entry(ids.contextA, "construction_works", "5051.2539"),
  entry(ids.contextB, "construction_works", "1000.1"),
  entry("60000000-0000-4000-8000-000000000001", "installation_works", "250.25"),
  entry(
    "60000000-0000-4000-8000-000000000002",
    "equipment_furniture_inventory",
    "50.005",
  ),
  entry("60000000-0000-4000-8000-000000000003", "other_costs", "10"),
]);
assert.deepEqual(totals, {
  currency: "MDL",
  constructionWorks: "6051.3539",
  installationWorks: "250.25",
  equipmentFurnitureInventory: "50.005",
  otherCosts: "10",
  total: "6361.6089",
});

const emptyCategoryTotals = calculateProfessionalObjectEstimate([
  entry(ids.contextA, "other_costs", "10"),
]);
assert.equal(emptyCategoryTotals.constructionWorks, "0");
assert.equal(emptyCategoryTotals.installationWorks, "0");
assert.equal(emptyCategoryTotals.equipmentFurnitureInventory, "0");
assert.equal(emptyCategoryTotals.otherCosts, "10");
assert.equal(emptyCategoryTotals.total, "10");
assert.throws(
  () => calculateProfessionalObjectEstimate([]),
  ProfessionalObjectEstimateAggregationError,
  "an empty object estimate has no valid zero total",
);
assert.throws(
  () =>
    calculateProfessionalObjectEstimate([
      entry(ids.contextA, "construction_works", "10", "MDL"),
      entry(ids.contextB, "construction_works", "1", "EUR"),
    ]),
  /different currencies/,
);
assert.throws(
  () =>
    calculateProfessionalObjectEstimate([
      entry(ids.contextA, "construction_works", "10"),
      entry(ids.contextA, "installation_works", "1"),
    ]),
  /only once/,
);
assert.throws(
  () =>
    calculateProfessionalObjectEstimate([
      entry(ids.contextA, "" as ProfessionalObjectEstimateCostCategory, "10"),
    ]),
  /explicit cost category/,
);

function localSummary(
  contextId: string,
  options: {
    objectId?: string;
    valuationDate?: string;
    currency?: "MDL" | "EUR";
  } = {},
): ProfessionalEstimateSummary {
  return {
    context: {
      id: contextId,
      organizationId: ids.organization,
      name: `Local ${contextId.slice(-1)}`,
      valuationDate: options.valuationDate ?? "2026-10-15",
      estimatePerspective: "investor",
      workKind: "construction",
      currency: options.currency ?? "MDL",
      method: "resource",
    },
    constructionObject: {
      id: options.objectId ?? ids.object,
      name: "Test object",
      code: null,
      address: null,
      description: null,
    },
    workQuantityList: {
      id: "70000000-0000-4000-8000-000000000001",
      name: "List",
      revision: 1,
      sourceReference: null,
      sourceDate: null,
      description: null,
    },
    itemCount: 1,
  };
}

function objectEstimateRecord(): ProfessionalObjectEstimateRecord {
  return {
    id: ids.objectEstimate,
    organizationId: ids.organization,
    constructionObjectId: ids.object,
    name: "Object estimate",
    code: null,
    valuationDate: "2026-10-15",
    currency: "MDL",
    notes: null,
    createdAt: new Date("2026-10-15T00:00:00Z"),
    updatedAt: new Date("2026-10-15T00:00:00Z"),
  };
}

function storedEntry(
  id: string,
  contextId: string,
  included: boolean,
  positionNumber: number,
): ProfessionalObjectEstimateEntryRecord {
  return {
    id,
    organizationId: ids.organization,
    objectEstimateId: ids.objectEstimate,
    calculationContextId: contextId,
    positionNumber,
    costCategory: "construction_works",
    included,
    notes: null,
    createdAt: new Date("2026-10-15T00:00:00Z"),
    updatedAt: new Date("2026-10-15T00:00:00Z"),
  };
}

function serviceFixture(
  entries: ProfessionalObjectEstimateEntryRecord[],
  calculations: Record<string, LiveLocalEstimateCalculation>,
  summaries = [localSummary(ids.contextA), localSummary(ids.contextB)],
  onUpdate?: (data: { included?: boolean; costCategory?: ProfessionalObjectEstimateCostCategory }) => void,
) {
  const estimate = objectEstimateRecord();
  const row: ProfessionalObjectEstimateSummaryRecord = {
    estimate,
    constructionObjectName: "Test object",
    entries,
  };
  const workspace: ProfessionalObjectEstimateWorkspaceRecord = row;
  const repository: ProfessionalObjectEstimateRepository = {
    async listConstructionObjects(orgId) {
      return orgId === ids.organization
        ? [{ id: ids.object, name: "Test object", code: null }]
        : [];
    },
    async constructionObjectExists(orgId, constructionObjectId) {
      return orgId === ids.organization && constructionObjectId === ids.object;
    },
    async list(orgId) {
      return orgId === ids.organization ? [row] : [];
    },
    async get(orgId, objectEstimateId) {
      return orgId === ids.organization && objectEstimateId === estimate.id
        ? workspace
        : null;
    },
    async create() {
      return estimate.id;
    },
    async addEntry() {
      return true;
    },
    async updateEntry(_orgId, _estimateId, _entryId, data) {
      onUpdate?.(data);
      return true;
    },
  };
  const service = new ProfessionalObjectEstimateService(
    repository,
    async (orgId) => (orgId === ids.organization ? summaries : []),
    async (_orgId, calculationContextId) => {
      const result = calculations[calculationContextId];
      if (!result) throw new LocalProfessionalEstimateNotFoundError();
      return result;
    },
  );
  return service;
}

function liveCalculation(
  calculationContextId: string,
  options: {
    amount?: string | null;
    complete?: boolean;
    objectId?: string;
    valuationDate?: string;
    currency?: "MDL" | "EUR";
  } = {},
): LiveLocalEstimateCalculation {
  return {
    calculationContextId,
    constructionObjectId: options.objectId ?? ids.object,
    name: `Local ${calculationContextId.slice(-1)}`,
    valuationDate: options.valuationDate ?? "2026-10-15",
    currency: options.currency ?? "MDL",
    subtotal: options.amount === undefined ? "10" : options.amount,
    complete: options.complete ?? true,
  };
}

async function main() {
const liveCalculations = {
  [ids.contextA]: liveCalculation(ids.contextA, { amount: "10" }),
  [ids.contextB]: liveCalculation(ids.contextB, {
    amount: null,
    complete: false,
  }),
};

const exclusionService = serviceFixture(
  [
    storedEntry(ids.entryA, ids.contextA, true, 1),
    storedEntry(ids.entryB, ids.contextB, false, 2),
  ],
  liveCalculations,
);
const withExcludedIncomplete = await exclusionService.get(
  ids.organization,
  ids.objectEstimate,
);
assert.equal(withExcludedIncomplete.complete, true);
assert.equal(withExcludedIncomplete.totals?.total, "10");
assert.equal(withExcludedIncomplete.entries[1]?.localEstimate?.complete, false);
assert.equal(withExcludedIncomplete.entries[1]?.included, false);

const includedIncompleteService = serviceFixture(
  [
    storedEntry(ids.entryA, ids.contextA, true, 1),
    storedEntry(ids.entryB, ids.contextB, true, 2),
  ],
  liveCalculations,
);
const withIncludedIncomplete = await includedIncompleteService.get(
  ids.organization,
  ids.objectEstimate,
);
assert.equal(withIncludedIncomplete.complete, false);
assert.equal(withIncludedIncomplete.totals, null);

const emptyService = serviceFixture([], liveCalculations);
const emptyEstimate = await emptyService.get(ids.organization, ids.objectEstimate);
assert.equal(emptyEstimate.complete, false);
assert.equal(emptyEstimate.totals, null);

const mutableCalculations = {
  [ids.contextA]: liveCalculation(ids.contextA, { amount: "10" }),
};
const liveService = serviceFixture(
  [storedEntry(ids.entryA, ids.contextA, true, 1)],
  mutableCalculations,
  [localSummary(ids.contextA)],
);
assert.equal(
  (await liveService.get(ids.organization, ids.objectEstimate)).totals?.total,
  "10",
);
mutableCalculations[ids.contextA] = liveCalculation(ids.contextA, { amount: "12.5" });
assert.equal(
  (await liveService.get(ids.organization, ids.objectEstimate)).totals?.total,
  "12.5",
  "live local changes must immediately update object aggregation",
);

let savedEntryUpdate:
  | { included?: boolean; costCategory?: ProfessionalObjectEstimateCostCategory }
  | undefined;
const entryUpdateService = serviceFixture(
  [storedEntry(ids.entryA, ids.contextA, true, 1)],
  { [ids.contextA]: liveCalculation(ids.contextA) },
  [localSummary(ids.contextA)],
  (data) => {
    savedEntryUpdate = data;
  },
);
await entryUpdateService.updateEntry(
  ids.organization,
  ids.objectEstimate,
  ids.entryA,
  { included: false },
);
assert.deepEqual(savedEntryUpdate, { included: false }, "exclusion persists as an update, not a delete");
await entryUpdateService.updateEntry(
  ids.organization,
  ids.objectEstimate,
  ids.entryA,
  { costCategory: "installation_works" },
);
assert.deepEqual(
  savedEntryUpdate,
  { costCategory: "installation_works" },
  "a user can explicitly correct the category",
);

const addEntryService = serviceFixture([], {
  [ids.contextA]: liveCalculation(ids.contextA),
  [ids.contextB]: liveCalculation(ids.contextB, { objectId: ids.anotherObject }),
});
assert.equal(
  await addEntryService.create(ids.organization, {
    constructionObjectId: ids.object,
    name: "Created object estimate",
    valuationDate: "2026-10-15",
    currency: "MDL",
  }),
  ids.objectEstimate,
);
await assert.rejects(
  addEntryService.create(ids.anotherOrganization, {
    constructionObjectId: ids.object,
    name: "Cross-organization object estimate",
    valuationDate: "2026-10-15",
    currency: "MDL",
  }),
  ProfessionalObjectEstimateValidationError,
  "objects from another organization cannot be selected",
);
await assert.rejects(
  addEntryService.addEntry(ids.organization, ids.objectEstimate, ids.contextA, ""),
  ProfessionalObjectEstimateValidationError,
  "category is required",
);
await assert.rejects(
  addEntryService.addEntry(ids.organization, "not-a-uuid", ids.contextA, "construction_works"),
  ProfessionalObjectEstimateNotFoundError,
  "malformed UUID produces a clean not-found error",
);
await assert.rejects(
  addEntryService.get(ids.anotherOrganization, ids.objectEstimate),
  ProfessionalObjectEstimateNotFoundError,
  "an estimate from another organization is inaccessible",
);
await assert.rejects(
  addEntryService.addEntry(
    ids.organization,
    ids.objectEstimate,
    "90000000-0000-4000-8000-000000000001",
    "construction_works",
  ),
  LocalProfessionalEstimateNotFoundError,
  "a local estimate unavailable to the current organization cannot be linked",
);

async function assertLinkRejected(
  calculation: LiveLocalEstimateCalculation,
  message: string,
) {
  const service = serviceFixture([], {
    [ids.contextA]: calculation,
  });
  await assert.rejects(
    service.addEntry(ids.organization, ids.objectEstimate, ids.contextA, "construction_works"),
    ProfessionalObjectEstimateValidationError,
    message,
  );
}

await assertLinkRejected(
  liveCalculation(ids.contextA, { objectId: ids.anotherObject }),
  "cross-object estimate is rejected",
);
await assertLinkRejected(
  liveCalculation(ids.contextA, { valuationDate: "2026-10-16" }),
  "different valuation date is rejected",
);
await assertLinkRejected(
  liveCalculation(ids.contextA, { currency: "EUR" }),
  "different currency is rejected",
);
await assert.rejects(
  addEntryService.addEntry(
    ids.organization,
    ids.objectEstimate,
    ids.contextB,
    "construction_works",
  ),
  ProfessionalObjectEstimateValidationError,
  "cross-object context from a different object is rejected",
);

const estimateActionsSource = readFileSync(
  join(process.cwd(), "app", "(app)", "professional-estimates", "actions.ts"),
  "utf8",
);
const createActionSource =
  estimateActionsSource.match(
    /export async function createProfessionalObjectEstimate[\s\S]*?(?=export async function addProfessionalObjectEstimateEntry)/,
  )?.[0] ?? "";
assert.match(createActionSource, /requireCurrentOrg\(\)/);
assert.match(createActionSource, /getProfessionalObjectEstimateService\(\)\.create\(\s*org\.id/);
assert.doesNotMatch(createActionSource, /formData\.get\(["']organizationId["']\)/);

console.log("Professional object estimate domain tests passed.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
