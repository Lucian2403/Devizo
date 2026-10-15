import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Module } from "node:module";
import { join } from "node:path";
import {
  DuplicateConstructionObjectCodeError,
  DuplicateWorkPositionError,
  type ProfessionalEstimateData,
  type ProfessionalEstimateSummary,
  type ProfessionalEstimateWorkspace,
  type ProfessionalEstimateWorkspaceRepository,
  type ValidatedProfessionalEstimateData,
  type WorkQuantityItem,
  type WorkQuantityItemData,
  type WorkQuantityItemUpdate,
} from "../domain/professional-estimates/professional-estimate-workspace.repository";
import {
  ProfessionalEstimateNotFoundError,
  ProfessionalEstimateValidationError,
  ProfessionalEstimateWorkspaceService,
} from "../domain/professional-estimates/professional-estimate-workspace.service";
import { formatRomanianDecimal } from "../lib/ui/decimal-display";
import {
  calculationContexts,
  constructionObjects,
  workQuantityLists,
} from "../infrastructure/db/schema/professionalEstimates";

class MemoryWorkspaceRepository
  implements ProfessionalEstimateWorkspaceRepository
{
  readonly created: Array<{
    object: { id: string; organizationId: string; name: string };
    list: {
      id: string;
      organizationId: string;
      constructionObjectId: string;
      name: string;
      revision: number;
    };
    context: {
      id: string;
      organizationId: string;
      constructionObjectId: string;
      workQuantityListId: string;
      name: string;
      valuationDate: string;
      currency: "MDL" | "EUR" | "RON" | "USD" | "GBP";
      method: "resource";
    };
    items: WorkQuantityItem[];
  }> = [];
  failAtContextCreation = false;
  readonly identifierCalls = { get: 0, createItem: 0, updateItem: 0 };

  async listProfessionalEstimates(
    organizationId: string,
  ): Promise<ProfessionalEstimateSummary[]> {
    return this.created
      .filter((entry) => entry.context.organizationId === organizationId)
      .map((entry) => ({
        context: {
          id: entry.context.id,
          organizationId: entry.context.organizationId,
          name: entry.context.name,
          valuationDate: entry.context.valuationDate,
          currency: entry.context.currency,
          method: entry.context.method,
        },
        constructionObject: {
          id: entry.object.id,
          name: entry.object.name,
          code: null,
          address: null,
          description: null,
        },
        workQuantityList: {
          id: entry.list.id,
          name: entry.list.name,
          revision: entry.list.revision,
          sourceReference: null,
          sourceDate: null,
          description: null,
        },
        itemCount: entry.items.length,
      }));
  }

  async getProfessionalEstimate(
    organizationId: string,
    calculationContextId: string,
  ): Promise<ProfessionalEstimateWorkspace | null> {
    this.identifierCalls.get++;
    const entry = this.created.find(
      (candidate) =>
        candidate.context.organizationId === organizationId &&
        candidate.context.id === calculationContextId &&
        candidate.list.organizationId === organizationId &&
        candidate.object.organizationId === organizationId &&
        candidate.context.workQuantityListId === candidate.list.id &&
        candidate.context.constructionObjectId === candidate.object.id &&
        candidate.list.constructionObjectId === candidate.object.id,
    );
    if (!entry) return null;
    return {
      context: {
        id: entry.context.id,
        organizationId: entry.context.organizationId,
        name: entry.context.name,
        valuationDate: entry.context.valuationDate,
        currency: entry.context.currency,
        method: entry.context.method,
      },
      constructionObject: {
        id: entry.object.id,
        name: entry.object.name,
        code: null,
        address: null,
        description: null,
      },
      workQuantityList: {
        id: entry.list.id,
        name: entry.list.name,
        revision: entry.list.revision,
        sourceReference: null,
        sourceDate: null,
        description: null,
      },
      items: [...entry.items],
    };
  }

  async createProfessionalEstimate(
    organizationId: string,
    data: ValidatedProfessionalEstimateData,
  ): Promise<string> {
    const objectId = `object-${this.created.length + 1}`;
    const listId = `list-${this.created.length + 1}`;
    const contextId = randomUUID();
    const draft = {
      object: {
        id: objectId,
        organizationId,
        name: data.objectName,
      },
      list: {
        id: listId,
        organizationId,
        constructionObjectId: objectId,
        name: data.listName,
        revision: 1,
      },
      context: {
        id: contextId,
        organizationId,
        constructionObjectId: objectId,
        workQuantityListId: listId,
        name: data.name,
        valuationDate: data.valuationDate,
        currency: data.currency,
        method: "resource" as const,
      },
      items: [],
    };
    if (this.failAtContextCreation) {
      this.failAtContextCreation = false;
      throw new Error("simulated context insert failure");
    }
    this.created.push(draft);
    return contextId;
  }

  async createWorkQuantityItem(
    organizationId: string,
    calculationContextId: string,
    data: WorkQuantityItemData,
  ): Promise<WorkQuantityItem | null> {
    this.identifierCalls.createItem++;
    const entry = this.created.find(
      (candidate) =>
        candidate.context.organizationId === organizationId &&
        candidate.context.id === calculationContextId,
    );
    if (!entry) return null;
    if (entry.items.some((item) => item.positionNumber === data.positionNumber)) {
      throw new DuplicateWorkPositionError(data.positionNumber);
    }
    const item: WorkQuantityItem = {
      id: randomUUID(),
      organizationId,
      workQuantityListId: entry.list.id,
      ...data,
      code: data.code ?? null,
      notes: data.notes ?? null,
    };
    entry.items.push(item);
    return item;
  }

  async updateWorkQuantityItem(
    organizationId: string,
    calculationContextId: string,
    itemId: string,
    data: WorkQuantityItemUpdate,
  ): Promise<WorkQuantityItem | null> {
    this.identifierCalls.updateItem++;
    const entry = this.created.find(
      (candidate) =>
        candidate.context.organizationId === organizationId &&
        candidate.context.id === calculationContextId,
    );
    const item = entry?.items.find(
      (candidate) =>
        candidate.id === itemId &&
        candidate.organizationId === organizationId &&
        candidate.workQuantityListId === entry.list.id,
    );
    if (!item) return null;
    Object.assign(item, data, { code: data.code ?? null, notes: data.notes ?? null });
    return item;
  }
}

async function main(): Promise<void> {
const repository = new MemoryWorkspaceRepository();
const service = new ProfessionalEstimateWorkspaceService(repository);
const estimateData: ProfessionalEstimateData = {
  name: "Deviz de test",
  objectName: "Obiect de test",
  listName: "Lista principală",
  valuationDate: "2026-10-15",
  currency: "MDL",
};

const contextId = await service.createProfessionalEstimate("org-a", estimateData);
const created = repository.created[0]!;
assert.equal(contextId, created.context.id);
assert.equal(created.object.organizationId, "org-a");
assert.equal(created.list.organizationId, "org-a");
assert.equal(created.context.organizationId, "org-a");
assert.equal(created.list.constructionObjectId, created.object.id);
assert.equal(created.context.constructionObjectId, created.object.id);
assert.equal(created.context.workQuantityListId, created.list.id);
assert.equal(created.list.revision, 1);
assert.equal(created.context.method, "resource");
assert.equal((await service.getProfessionalEstimate("org-a", contextId)).items.length, 0);
await assert.rejects(
  service.getProfessionalEstimate("org-b", contextId),
  ProfessionalEstimateNotFoundError,
);

const itemData: WorkQuantityItemData = {
  positionNumber: 1,
  code: "T-1",
  description: "Tencuieli interioare",
  unit: "m²",
  quantity: "250.000000",
};
for (const invalidId of ["abc", "", "not-a-uuid", `${contextId} `]) {
  const callsBefore = { ...repository.identifierCalls };
  await assert.rejects(
    service.getProfessionalEstimate("org-a", invalidId),
    ProfessionalEstimateNotFoundError,
  );
  await assert.rejects(
    service.createWorkQuantityItem("org-a", invalidId, itemData),
    ProfessionalEstimateNotFoundError,
  );
  await assert.rejects(
    service.updateWorkQuantityItem("org-a", invalidId, randomUUID(), itemData),
    ProfessionalEstimateNotFoundError,
  );
  await assert.rejects(
    service.updateWorkQuantityItem("org-a", contextId, invalidId, itemData),
    ProfessionalEstimateNotFoundError,
  );
  assert.deepEqual(
    repository.identifierCalls,
    callsBefore,
    "malformed context/item UUIDs must not reach any repository method",
  );
}
const item = await service.createWorkQuantityItem("org-a", contextId, itemData);
assert.equal(item.quantity, "250.000000");
assert.equal(item.workQuantityListId, created.list.id);
await assert.rejects(
  service.createWorkQuantityItem("org-a", contextId, itemData),
  DuplicateWorkPositionError,
);
for (const quantity of ["0", "-1", "not-a-decimal", "Infinity", "1e2"]) {
  await assert.rejects(
    service.createWorkQuantityItem("org-a", contextId, {
      ...itemData,
      positionNumber: 2,
      quantity,
    }),
    ProfessionalEstimateValidationError,
    `expected invalid quantity to reject: ${quantity}`,
  );
}
await assert.rejects(
  service.createWorkQuantityItem("org-a", contextId, {
    ...itemData,
    positionNumber: 2,
    description: " ",
  }),
  ProfessionalEstimateValidationError,
);
await assert.rejects(
  service.createWorkQuantityItem("org-a", contextId, {
    ...itemData,
    positionNumber: 2,
    unit: " ",
  }),
  ProfessionalEstimateValidationError,
);
await assert.rejects(
  service.createWorkQuantityItem("org-a", contextId, {
    ...itemData,
    positionNumber: 0,
  }),
  ProfessionalEstimateValidationError,
);

const updatedItem = await service.updateWorkQuantityItem(
  "org-a",
  contextId,
  item.id,
  { ...itemData, quantity: "275.250000" },
);
assert.equal(updatedItem.positionNumber, 1);
assert.equal(updatedItem.quantity, "275.250000");
assert.equal(
  await repository.updateWorkQuantityItem("org-b", contextId, item.id, {
    code: "",
    description: item.description,
    unit: item.unit,
    quantity: "300",
  }),
  null,
);
assert.equal(
  (await service.listProfessionalEstimates("org-a"))[0]?.itemCount,
  1,
);
assert.equal((await service.listProfessionalEstimates("org-b")).length, 0);

assert.throws(
  () => service.createProfessionalEstimate("org-a", {
    ...estimateData,
    valuationDate: "2026-02-30",
  }),
  ProfessionalEstimateValidationError,
);
assert.throws(
  () => service.createProfessionalEstimate("org-a", {
    ...estimateData,
    currency: "CHF",
  }),
  ProfessionalEstimateValidationError,
);

repository.failAtContextCreation = true;
await assert.rejects(
  service.createProfessionalEstimate("org-a", estimateData),
  /simulated context insert failure/,
);
assert.equal(repository.created.length, 1, "failed creation must leave no partial workspace");

const workspaceRepositorySource = readFileSync(
  join(
    process.cwd(),
    "infrastructure/db/repositories/professionalEstimateWorkspace.repository.ts",
  ),
  "utf8",
);
const workspaceServiceSource = readFileSync(
  join(
    process.cwd(),
    "domain/professional-estimates/professional-estimate-workspace.service.ts",
  ),
  "utf8",
);
assert.match(workspaceRepositorySource, /return await db\.transaction\(async \(tx\)/);
for (const table of [
  "constructionObjects",
  "workQuantityLists",
  "calculationContexts",
]) {
  assert.match(
    workspaceRepositorySource,
    new RegExp(`tx\\s*\\.insert\\(${table}\\)`),
  );
}
assert.match(workspaceRepositorySource, /eq\(calculationContexts\.organizationId, organizationId\)/);
assert.match(workspaceRepositorySource, /eq\(workQuantityItems\.organizationId, organizationId\)/);
assert.match(workspaceRepositorySource, /count\(\)/);
assert.doesNotMatch(workspaceRepositorySource, /catalogItems|quoteItems|sellingPrice|quote_items|catalog_items|selling_price/);
assert.doesNotMatch(workspaceRepositorySource, /normApplications|calculationRules|resourcePrices/);
assert.match(workspaceServiceSource, /parseDecimal\(value\.trim\(\)/);

const detailPageSource = readFileSync(
  join(
    process.cwd(),
    "app/(app)/professional-estimates/[calculationContextId]/page.tsx",
  ),
  "utf8",
);
assert.match(detailPageSource, /ProfessionalEstimateNotFoundError\) notFound\(\)/);
assert.match(detailPageSource, /import \{ formatRomanianDecimal \} from "@\/lib\/ui\/decimal-display"/);
assert.match(detailPageSource, /formatRomanianDecimal\(item\.quantity\)/);
assert.doesNotMatch(detailPageSource, /formatDecimalRo/);
assert.equal(existsSync(join(process.cwd(), "lib/i18n/decimal.ts")), false);
const actionSource = readFileSync(
  join(process.cwd(), "app/(app)/professional-estimates/actions.ts"),
  "utf8",
);
assert.match(actionSource, /error instanceof DuplicateConstructionObjectCodeError/);
for (const [value, expected] of [
  ["250.000000", "250"],
  ["1250.500000", "1250,5"],
  ["275.250000", "275,25"],
  ["999999999999.999999", "999999999999,999999"],
]) {
  assert.equal(formatRomanianDecimal(value!), expected);
}

await testRepositoryTransaction();
console.log("Professional estimate workspace tests passed.");
}

async function testRepositoryTransaction(): Promise<void> {
  // Replace only the connection module so the real adapter runs its transaction
  // and error translation without requiring credentials or a live database.
  const connectionPath = require.resolve("../infrastructure/db");
  const originalModule = require.cache[connectionPath];
  const committed: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  let insertError: unknown;
  let failAtTable: unknown;
  let rollbacks = 0;
  let attemptedTables: unknown[] = [];
  const fakeDatabase = {
    async transaction<T>(callback: (tx: {
      insert: (table: unknown) => {
        values: (values: Record<string, unknown>) => {
          returning: () => Promise<Array<{ id: string }>>;
        };
      };
    }) => Promise<T>): Promise<T> {
      const pending: typeof committed = [];
      attemptedTables = [];
      try {
        const result = await callback({
          insert(table) {
            return {
              values(values) {
                return {
                  async returning() {
                    attemptedTables.push(table);
                    if (table === failAtTable) throw insertError;
                    const id = randomUUID();
                    pending.push({ table, values: { ...values, id } });
                    return [{ id }];
                  },
                };
              },
            };
          },
        });
        committed.push(...pending);
        return result;
      } catch (error) {
        rollbacks++;
        throw error;
      }
    },
  };
  const connectionModule = new Module(connectionPath);
  connectionModule.exports = { db: fakeDatabase };
  require.cache[connectionPath] = connectionModule;
  try {
    const { DrizzleProfessionalEstimateWorkspaceRepository } = await import(
      "../infrastructure/db/repositories/professionalEstimateWorkspace.repository"
    );
    const adapter = new DrizzleProfessionalEstimateWorkspaceRepository();
    const data: ValidatedProfessionalEstimateData = {
      name: "Test",
      objectName: "Obiect",
      listName: "Listă",
      valuationDate: "2026-10-15",
      currency: "MDL",
      objectCode: "OBJ-001",
    };
    await adapter.createProfessionalEstimate("org-a", data);
    assert.deepEqual(
      committed.map((row) => row.table),
      [constructionObjects, workQuantityLists, calculationContexts],
    );
    const originalRows = [...committed];
    for (const constraintField of ["constraint_name", "constraint"]) {
      failAtTable = constructionObjects;
      insertError = {
        code: "23505",
        [constraintField]: "construction_objects_org_code_unique",
      };
      await assert.rejects(
        adapter.createProfessionalEstimate("org-a", data),
        (error: unknown) =>
          error instanceof DuplicateConstructionObjectCodeError &&
          error.objectCode === "OBJ-001" &&
          error.message === "Codul obiectului «OBJ-001» este deja folosit în această companie.",
      );
      assert.deepEqual(committed, originalRows, "duplicate code must leave all three tables unchanged");
      assert.deepEqual(attemptedTables, [constructionObjects], "no list or context insert after conflict");
    }
    for (const unexpectedError of [
      { code: "23505", constraint_name: "another_unique_constraint" },
      { code: "23503", constraint_name: "construction_objects_org_code_unique" },
      new Error("connection failure"),
    ]) {
      insertError = unexpectedError;
      await assert.rejects(
        adapter.createProfessionalEstimate("org-a", data),
        (error: unknown) => error === unexpectedError,
      );
      assert.deepEqual(committed, originalRows);
    }
    failAtTable = calculationContexts;
    insertError = new Error("context insert failed");
    await assert.rejects(
      adapter.createProfessionalEstimate("org-a", { ...data, objectCode: "OBJ-002" }),
      (error: unknown) => error === insertError,
    );
    assert.deepEqual(committed, originalRows, "context failure rolls back object and list inserts");
    assert.equal(rollbacks, 6);
  } finally {
    if (originalModule) require.cache[connectionPath] = originalModule;
    else delete require.cache[connectionPath];
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
