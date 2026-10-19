import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateProcurementStorage, calculateProcurementStorageAmount } from "../domain/professional-estimates/calculation/procurement-storage";
import { CP_L_01_07_2012_RULE_PACK } from "../domain/professional-estimates/official-rule-packs/cp-l-01-07-2012";
import { ProfessionalRuleDefinitionService } from "../domain/professional-estimates/professional-rule-definitions.service";
import type { ProfessionalRuleDefinitionRecord, ProfessionalRuleDefinitionRepository } from "../domain/professional-estimates/professional-rule-definitions.repository";
import type { PriceSemantics, ProcurementCategory } from "../domain/professional-estimates/procurement-semantics";
import {
  ProfessionalResourcePriceNotFoundError,
  ProfessionalResourcePriceValidationError,
  ProfessionalResourcePricesService,
  type ResourcePricingPositionInput,
} from "../domain/professional-estimates/professional-resource-prices.service";
import type {
  CreateResourcePriceData,
  ProfessionalResourcePricesRepository,
  ResourcePriceCandidateRecord,
  ResourcePriceRecord,
} from "../domain/professional-estimates/professional-resource-prices.repository";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const resourceIds = {
  labor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  material: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  machinery: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  unpriced: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  zero: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
} as const;

function price(
  resourceId: string,
  overrides: Partial<ResourcePriceCandidateRecord> = {},
): ResourcePriceCandidateRecord {
  return {
    id: `price-${resourceId}`,
    resourcePriceId: `price-${resourceId}`,
    organizationId,
    resourceId,
    sourceId: null,
    price: "100",
    basisQuantity: "1",
    priceBasisQuantity: "1",
    currency: "MDL",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    sourceType: "manual",
    sourceReference: "Acceptare tehnică",
    location: "Chișinău",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    vatTreatment: "unknown",
    transportTreatment: "unknown",
    ...overrides,
  };
}

class FakeResourcePriceRepository implements ProfessionalResourcePricesRepository {
  candidates: ResourcePriceCandidateRecord[] = [];
  created: ResourcePriceRecord[] = [];
  requestedOrganization: string | null = null;
  requestedResourceIds: string[] = [];
  requestedCurrency: string | null = null;
  resourceExists = true;
  category: ProcurementCategory | null = null;
  readonly priceId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

  async updatePriceSemantics(
    orgId: string, resourceId: string, priceId: string, data: PriceSemantics,
  ) {
    if (orgId !== organizationId || resourceId !== resourceIds.material || priceId !== this.priceId) return false;
    const candidate = this.candidates.find((entry) => entry.id === priceId);
    if (!candidate) return false;
    candidate.vatTreatment = data.vatTreatment;
    candidate.transportTreatment = data.transportTreatment;
    return true;
  }

  async updateProcurementCategory(
    orgId: string, resourceId: string, category: ProcurementCategory | null,
  ) {
    if (orgId !== organizationId || resourceId !== resourceIds.material) return false;
    this.category = category;
    return true;
  }

  async listProfessionalResourcesWithPrices() {
    return [];
  }

  async getProfessionalResourceWithPrices() {
    return null;
  }

  async createResourcePrice(
    orgId: string,
    resourceId: string,
    data: CreateResourcePriceData,
  ) {
    if (!this.resourceExists || orgId !== organizationId || !resourceId) {
      return null;
    }
    const created: ResourcePriceRecord = {
      id: `created-${this.created.length}`,
      organizationId: orgId,
      resourceId,
      sourceId: null,
      price: data.price,
      basisQuantity: data.basisQuantity,
      currency: data.currency,
      validFrom: data.validFrom,
      validTo: data.validTo ?? null,
      sourceType: data.sourceType,
      sourceReference: data.sourceReference ?? null,
      location: data.location ?? null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      vatTreatment: data.vatTreatment,
      transportTreatment: data.transportTreatment,
    };
    this.created.push(created);
    return created;
  }

  async listPriceCandidates(
    orgId: string,
    ids: string[],
    currency: "MDL" | "EUR" | "RON" | "USD" | "GBP",
  ) {
    this.requestedOrganization = orgId;
    this.requestedResourceIds = ids;
    this.requestedCurrency = currency;
    return this.candidates;
  }
}

function line(
  id: string,
  resourceId: string,
  resourceType: "labor" | "material" | "machinery" | "other",
  normativeConsumption: string,
  unit: string,
): ResourcePricingPositionInput["resources"][number] {
  return {
    id,
    code: id,
    name: id,
    resourceId,
    resourceType,
    procurementCategory: null,
    normativeConsumption,
    unit,
    resourceConsumptionId: `consumption-${id}`,
  };
}

const position: ResourcePricingPositionInput = {
  workQuantityItemId: "work-1",
  workQuantity: "275",
  estimateNormVersionId: "norm-version-1",
  normApplicationId: "norm-application-1",
  normBasisQuantity: "100",
  applicationCoefficient: "1",
  resources: [
    line("LAB-001", resourceIds.labor, "labor", "10", "h"),
    line("MAT-001", resourceIds.material, "material", "3", "kg"),
    line("MCH-001", resourceIds.machinery, "machinery", "2", "h"),
  ],
};

const repository = new FakeResourcePriceRepository();
repository.candidates = [
  price(resourceIds.labor, { price: "100" }),
  price(resourceIds.material, {
    price: "1200",
    basisQuantity: "100",
    priceBasisQuantity: "100",
  }),
  price(resourceIds.machinery, { price: "250" }),
];
const service = new ProfessionalResourcePricesService(repository);

async function main(): Promise<void> {
// The acceptance fixture proves quantities, normalized price basis and totals.
{
  const result = await service.calculateDirectResourceCosts(
    organizationId,
    "MDL",
    "2026-06-15",
    [position],
  );
  const costs = result.positionsByWorkItemId["work-1"];
  assert.equal(costs?.complete, true);
  assert.equal(costs?.requiredPriceCount, 3);
  assert.equal(costs?.pricedResourceCount, 3);
  assert.equal(costs?.directResourceTotal, "4224");
  assert.equal(costs?.resources[0]?.resourceQuantity, "27.5");
  assert.equal(costs?.resources[0]?.calculation?.effectiveUnitPrice, "100");
  assert.equal(costs?.resources[0]?.calculation?.resourceCost, "2750");
  assert.equal(costs?.resources[1]?.resourceQuantity, "8.25");
  assert.equal(costs?.resources[1]?.calculation?.effectiveUnitPrice, "12");
  assert.equal(costs?.resources[1]?.calculation?.resourceCost, "99");
  assert.equal(costs?.resources[2]?.resourceQuantity, "5.5");
  assert.equal(costs?.resources[2]?.calculation?.resourceCost, "1375");
  assert.equal(costs?.totalsByResourceType?.labor, "2750");
  assert.equal(costs?.totalsByResourceType?.material, "99");
  assert.equal(costs?.totalsByResourceType?.machinery, "1375");
  assert.equal(
    costs?.resources[0]?.calculation?.estimateNormVersionId,
    "norm-version-1",
  );
  assert.equal(
    costs?.resources[0]?.calculation?.resourceConsumptionId,
    "consumption-LAB-001",
  );
  assert.equal(
    costs?.resources[0]?.calculation?.normApplicationId,
    "norm-application-1",
  );
  assert.equal(costs?.resources[0]?.selectedPrice?.sourceType, "manual");
  assert.equal(
    costs?.resources[0]?.selectedPrice?.sourceReference,
    "Acceptare tehnică",
  );
  assert.equal(costs?.resources[0]?.selectedPrice?.location, "Chișinău");
  assert.equal(costs?.resources[0]?.selectedPrice?.validFrom, "2026-01-01");
  assert.equal(costs?.resources[0]?.selectedPrice?.validTo, "2026-12-31");
  assert.equal(costs?.resources[0]?.selectedPrice?.currency, "MDL");
  assert.equal(costs?.resources[0]?.selectedPrice?.basisQuantity, "1");
  assert.equal(repository.requestedCurrency, "MDL");
}

// Currency is exact: only MDL candidates reach the calculator for an MDL estimate.
{
  repository.candidates = [
    price(resourceIds.labor),
    price(resourceIds.labor, {
      id: "eur-price",
      resourcePriceId: "eur-price",
      currency: "EUR",
    }),
  ];
  const result = await service.calculateDirectResourceCosts(
    organizationId,
    "MDL",
    "2026-06-15",
    [{ ...position, resources: [position.resources[0]!] }],
  );
  const labor = result.positionsByWorkItemId["work-1"]?.resources[0];
  assert.equal(labor?.priceStatus, "selected");
  assert.equal(labor?.selectedPrice?.currency, "MDL");
  assert.equal(labor?.calculation?.currency, "MDL");
  assert.equal(labor?.calculation?.resourceCost, "2750");
  assert.equal(repository.requestedCurrency, "MDL");
}

{
  repository.candidates = [
    price(resourceIds.labor, { currency: "EUR" }),
  ];
  const result = await service.calculateDirectResourceCosts(
    organizationId,
    "MDL",
    "2026-06-15",
    [{ ...position, resources: [position.resources[0]!] }],
  );
  const labor = result.positionsByWorkItemId["work-1"]?.resources[0];
  assert.equal(labor?.priceStatus, "missing");
  assert.equal(labor?.calculation, null);
  assert.equal(result.positionsByWorkItemId["work-1"]?.directResourceTotal, null);
}

// Another organization's and another resource's rows cannot satisfy a requirement.
{
  repository.candidates = [
    price(resourceIds.unpriced, { id: "other-resource", resourcePriceId: "other-resource" }),
    price(resourceIds.labor, {
      id: "other-org",
      resourcePriceId: "other-org",
      organizationId: otherOrganizationId,
    }),
  ];
  const result = await service.calculateDirectResourceCosts(
    organizationId,
    "MDL",
    "2026-06-15",
    [{ ...position, resources: [position.resources[0]!] }],
  );
  assert.equal(
    result.positionsByWorkItemId["work-1"]?.resources[0]?.priceStatus,
    "missing",
  );
  assert.equal(repository.requestedOrganization, organizationId);
  assert.deepEqual(repository.requestedResourceIds, [resourceIds.labor]);
}

// Overlapping prices remain ambiguous without a hidden tie-break.
{
  repository.candidates = [
    price(resourceIds.labor, { id: "price-a", resourcePriceId: "price-a" }),
    price(resourceIds.labor, {
      id: "price-b",
      resourcePriceId: "price-b",
      price: "110",
    }),
  ];
  const result = await service.calculateDirectResourceCosts(
    organizationId,
    "MDL",
    "2026-06-15",
    [{ ...position, resources: [position.resources[0]!] }],
  );
  const costs = result.positionsByWorkItemId["work-1"];
  assert.equal(costs?.resources[0]?.priceStatus, "ambiguous");
  assert.equal(costs?.resources[0]?.eligiblePriceCount, 2);
  assert.equal(costs?.directResourceTotal, null);
}

// Missing prices on a non-zero requirement make the position incomplete.
{
  repository.candidates = [
    price(resourceIds.labor),
    price(resourceIds.machinery, { price: "250" }),
  ];
  const result = await service.calculateDirectResourceCosts(
    organizationId,
    "MDL",
    "2026-06-15",
    [position],
  );
  assert.equal(result.positionsByWorkItemId["work-1"]?.complete, false);
  assert.equal(result.positionsByWorkItemId["work-1"]?.directResourceTotal, null);
  assert.equal(
    result.positionsByWorkItemId["work-1"]?.resources[1]?.priceStatus,
    "missing",
  );
  assert.equal(result.positionsByWorkItemId["work-1"]?.resources[0]?.calculation?.resourceCost, "2750");
}

// A zero-quantity resource does not require a price or reach calculateResources.
{
  repository.candidates = [];
  const result = await service.calculateDirectResourceCosts(
    organizationId,
    "MDL",
    "2026-06-15",
    [{
      ...position,
      resources: [line("ZERO-001", resourceIds.zero, "other", "0", "pcs")],
    }],
  );
  const costs = result.positionsByWorkItemId["work-1"];
  assert.equal(costs?.resources[0]?.resourceQuantity, "0");
  assert.equal(costs?.resources[0]?.priceStatus, "zero");
  assert.equal(costs?.resources[0]?.selectedPrice, null);
  assert.equal(costs?.requiredPriceCount, 0);
  assert.equal(costs?.complete, true);
  assert.equal(costs?.directResourceTotal, "0");
  assert.equal(result.completePositionCount, 1);
  assert.deepEqual(repository.requestedResourceIds, [resourceIds.zero]);
}

// An empty norm composition is incomplete, unlike a present zero-quantity line.
{
  repository.candidates = [];
  const result = await service.calculateDirectResourceCosts(
    organizationId,
    "MDL",
    "2026-06-15",
    [{ ...position, resources: [] }],
  );
  const costs = result.positionsByWorkItemId["work-1"];
  assert.equal(costs?.complete, false);
  assert.equal(costs?.directResourceTotal, null);
  assert.equal(costs?.totalsByResourceType, null);
  assert.equal(result.completePositionCount, 0);
  assert.equal(result.requiredPriceCount, 0);
  assert.equal(result.pricedResourceCount, 0);
}

// Date eligibility keeps inclusive boundaries and refuses out-of-window prices.
{
  repository.candidates = [
    price(resourceIds.labor, { validFrom: "2026-06-15", validTo: "2026-06-15" }),
  ];
  const onBoundary = await service.resolvePriceStatus(
    organizationId,
    resourceIds.labor,
    "MDL",
    "2026-06-15",
  );
  assert.equal(onBoundary.status, "selected");
  assert.equal(
    (await service.resolvePriceStatus(
      organizationId,
      resourceIds.labor,
      "MDL",
      "2026-06-14",
    )).status,
    "missing",
  );
  assert.equal(
    (await service.resolvePriceStatus(
      organizationId,
      resourceIds.labor,
      "MDL",
      "2026-06-16",
    )).status,
    "missing",
  );
}

// Decimal validation respects the resource_prices numeric(18, 6) shape.
{
  repository.resourceExists = false;
  await assert.rejects(
    service.createResourcePrice(organizationId, resourceIds.labor, {
      vatTreatment: "unknown", transportTreatment: "unknown",
      price: "1",
      basisQuantity: "1",
      currency: "MDL",
      validFrom: "2026-01-01",
      sourceType: "manual",
    }),
    ProfessionalResourcePriceNotFoundError,
  );
  repository.resourceExists = true;

  const validPrice = await service.createResourcePrice(
    organizationId,
    resourceIds.labor,
    {
      vatTreatment: "unknown", transportTreatment: "unknown",
      price: "0",
      basisQuantity: "1.25",
      currency: "MDL",
      validFrom: "2026-01-01",
      sourceType: "manual",
    },
  );
  assert.equal(validPrice.price, "0");
  assert.equal(validPrice.sourceId, null);

  const invalidInputs: Omit<CreateResourcePriceData, keyof PriceSemantics>[] = [
    { price: "-1", basisQuantity: "1", currency: "MDL", validFrom: "2026-01-01", sourceType: "manual" },
    { price: "1.1234567", basisQuantity: "1", currency: "MDL", validFrom: "2026-01-01", sourceType: "manual" },
    { price: "1", basisQuantity: "0", currency: "MDL", validFrom: "2026-01-01", sourceType: "manual" },
    { price: "1", basisQuantity: "1", currency: "MDL", validFrom: "2026-02-30", sourceType: "manual" },
    { price: "1", basisQuantity: "1", currency: "MDL", validFrom: "2026-02-01", validTo: "2026-01-31", sourceType: "manual" },
    { price: "1", basisQuantity: "1", currency: "CAD" as CreateResourcePriceData["currency"], validFrom: "2026-01-01", sourceType: "manual" },
    { price: "1", basisQuantity: "1", currency: "MDL", validFrom: "2026-01-01", sourceType: "invalid" as CreateResourcePriceData["sourceType"] },
  ];
  for (const input of invalidInputs) {
    await assert.rejects(
      service.createResourcePrice(organizationId, resourceIds.labor, {
        ...input, vatTreatment: "unknown", transportTreatment: "unknown",
      }),
      ProfessionalResourcePriceValidationError,
    );
  }
}

// M8.4D: actual persisted-definition mapping and governance gate feed the same resolver.
{
  const definitions: ProfessionalRuleDefinitionRecord[] = CP_L_01_07_2012_RULE_PACK.map((entry, index) => ({
    ...entry,
    id: `persisted-rule-${index}`, organizationId, sourceId: "official-source",
    applicabilityDecisionId: "decision-1", notes: null,
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  }));
  const rulesRepository: ProfessionalRuleDefinitionRepository = {
    async createRuleDefinition() { throw new Error("No rules are created by estimate calculation."); },
    async getRuleDefinition(org, id) { return definitions.find((row) => row.organizationId === org && row.id === id) ?? null; },
    async listRuleDefinitionsForComponent(org, component) {
      assert.equal(org, organizationId);
      return definitions.filter((row) => row.organizationId === org && row.component === component);
    },
    async listRuleDefinitionsForSource() { return []; },
    async getApplicabilityDecisionForSource(org, sourceId, id) {
      assert.equal(org, organizationId);
      return { id, sourceId, decision: "applicable", applicableFrom: "2012-08-17", applicableUntil: null };
    },
  };
  const candidates = await new ProfessionalRuleDefinitionService(rulesRepository)
    .loadCandidatesForComponent(organizationId, "procurement_storage");
  const context = {
    estimatePerspective: "investor" as const, workKind: "construction" as const,
    valuationDate: "2026-06-15", currency: "MDL",
  };
  const classifiedPosition: ResourcePricingPositionInput = {
    ...position,
    resources: position.resources.map((entry) => ({
      ...entry, procurementCategory: "construction_materials",
    })),
  };
  repository.candidates = [
    price(resourceIds.labor, { price: "100" }),
    price(resourceIds.material, {
      id: repository.priceId, resourcePriceId: repository.priceId,
      price: "1200", basisQuantity: "100", priceBasisQuantity: "100",
      vatTreatment: "exclusive", transportTreatment: "excluded",
    }),
    price(resourceIds.machinery, { price: "250" }),
  ];
  const calculate = async (input = classifiedPosition) =>
    service.calculateDirectResourceCosts(organizationId, "MDL", context.valuationDate, [input]);
  const direct = await calculate();
  const result = calculateProcurementStorage(direct, context, candidates);
  assert.equal(direct.positionsByWorkItemId["work-1"]?.directResourceTotal, "4224");
  assert.equal(result.procurementStorageTotal, "1.98");
  assert.equal(result.directPlusProcurement, "4225.98");
  assert.equal(result.categories.length, 1);
  const application = result.categories[0]?.application;
  assert.equal(application?.materialBase, "99");
  assert.equal(application?.professionalRuleDefinitionId, "persisted-rule-0");
  assert.equal(application?.sourceId, "official-source");
  assert.equal(application?.applicabilityDecisionId, "decision-1");
  assert.equal(application?.materials[0]?.resourcePriceId, repository.priceId);
  assert.equal(application?.materials.length, 1, "Non-material types never enter the material base.");
  assert.equal(application?.valuationDate, context.valuationDate);

  for (const semantics of [
    { vatTreatment: "inclusive", transportTreatment: "excluded" },
    { vatTreatment: "unknown", transportTreatment: "excluded" },
    { vatTreatment: "exclusive", transportTreatment: "included" },
    { vatTreatment: "exclusive", transportTreatment: "unknown" },
    { vatTreatment: "unknown", transportTreatment: "unknown" },
  ] satisfies PriceSemantics[]) {
    await service.updatePriceSemantics(organizationId, resourceIds.material, repository.priceId, semantics);
    const blocked = calculateProcurementStorage(await calculate(), context, candidates);
    assert.equal(blocked.blocks[0]?.reason, "price_semantics");
    assert.equal(blocked.procurementStorageTotal, null);
    assert.equal(blocked.directPlusProcurement, null);
    assert.equal(blocked.categories.length, 0);
  }
  const before = { ...repository.candidates[1]! };
  const semanticsOnly = {
    vatTreatment: "exclusive", transportTreatment: "excluded",
    price: "99999", sourceReference: "must not change", currency: "EUR",
  };
  await service.updatePriceSemantics(organizationId, resourceIds.material, repository.priceId, semanticsOnly);
  assert.deepEqual(repository.candidates[1], {
    ...before, vatTreatment: "exclusive", transportTreatment: "excluded",
  }, "Classification changes no monetary or provenance field.");
  await assert.rejects(service.updatePriceSemantics(
    otherOrganizationId, resourceIds.material, repository.priceId, semanticsOnly,
  ), ProfessionalResourcePriceNotFoundError);
  await assert.rejects(service.updatePriceSemantics(
    organizationId, resourceIds.material, "bad-id", semanticsOnly,
  ), ProfessionalResourcePriceNotFoundError);
  await assert.rejects(service.updatePriceSemantics(
    organizationId, resourceIds.material, repository.priceId,
    { vatTreatment: "", transportTreatment: "excluded" },
  ), ProfessionalResourcePriceValidationError);
  for (const category of ["construction_materials", "metal_structures", "equipment", "other", ""]) {
    await service.updateProcurementCategory(organizationId, resourceIds.material, category);
    assert.equal(repository.category, category || null);
  }
  await assert.rejects(service.updateProcurementCategory(
    otherOrganizationId, resourceIds.material, "construction_materials",
  ), ProfessionalResourcePriceNotFoundError);
  await assert.rejects(service.updateProcurementCategory(
    organizationId, resourceIds.labor, "construction_materials",
  ), ProfessionalResourcePriceNotFoundError);
  await assert.rejects(service.updateProcurementCategory(
    organizationId, resourceIds.material, "inferred",
  ), ProfessionalResourcePriceValidationError);

  const contractor = calculateProcurementStorage(direct, { ...context, estimatePerspective: "contractor" }, candidates);
  assert.equal(contractor.categories[0]?.resolution.status, "missing");
  assert.equal(contractor.procurementStorageTotal, null);
  const early = calculateProcurementStorage(direct, { ...context, valuationDate: "2012-08-16" }, candidates);
  assert.equal(early.categories[0]?.resolution.status, "missing");
  const boundary = calculateProcurementStorage(direct, { ...context, valuationDate: "2012-08-17" }, candidates);
  assert.equal(boundary.categories[0]?.resolution.status, "selected");
  const overlapping = calculateProcurementStorage(direct, context, [
    ...candidates, { ...candidates[0]!, candidateId: "overlap" },
  ]);
  assert.equal(overlapping.categories[0]?.resolution.status, "ambiguous");
  assert.equal(overlapping.categories[0]?.application, null);
  assert.equal(overlapping.procurementStorageTotal, null);
  const missing = calculateProcurementStorage(direct, context, []);
  assert.equal(missing.categories[0]?.resolution.status, "missing");
  assert.equal(missing.directPlusProcurement, null);
  const noContext = calculateProcurementStorage(direct, { ...context, estimatePerspective: null }, candidates);
  assert.equal(noContext.contextComplete, false);
  assert.equal(noContext.procurementStorageTotal, null);
  for (const category of ["equipment", "other", null] as const) {
    const changed = await calculate({
      ...classifiedPosition,
      resources: classifiedPosition.resources.map((entry) => ({ ...entry, procurementCategory: category })),
    });
    const unresolved = calculateProcurementStorage(changed, context, candidates);
    assert.equal(unresolved.procurementStorageTotal, null);
    if (category === null) assert.equal(unresolved.blocks[0]?.reason, "category");
    else assert.equal(unresolved.categories[0]?.resolution.status, "missing");
  }
  const selectedPrice = repository.candidates[1]!;
  repository.candidates = repository.candidates.filter((entry) => entry.resourceId !== resourceIds.material);
  const priceMissing = calculateProcurementStorage(await calculate(), context, candidates);
  assert.equal(priceMissing.blocks[0]?.reason, "direct_price");
  repository.candidates.push(selectedPrice, { ...selectedPrice, id: "duplicate", resourcePriceId: "duplicate" });
  const priceAmbiguous = calculateProcurementStorage(await calculate(), context, candidates);
  assert.equal(priceAmbiguous.blocks[0]?.reason, "direct_price");
  assert.equal(priceAmbiguous.procurementStorageTotal, null);

  const multiPosition: ResourcePricingPositionInput = {
    ...position, workQuantity: "1", normBasisQuantity: "1",
    resources: [
      { ...line("A", resourceIds.material, "material", "1", "kg"), procurementCategory: "construction_materials" },
      { ...line("B", resourceIds.unpriced, "material", "1", "kg"), procurementCategory: "metal_structures" },
    ],
  };
  repository.candidates = [
    price(resourceIds.material, { price: "100", vatTreatment: "exclusive", transportTreatment: "excluded" }),
    price(resourceIds.unpriced, { price: "200", vatTreatment: "exclusive", transportTreatment: "excluded" }),
  ];
  const multi = calculateProcurementStorage(await calculate(multiPosition), context, candidates);
  assert.deepEqual(multi.categories.map((entry) => [
    entry.category, entry.materialBase, entry.application?.amount,
  ]), [["construction_materials", "100", "2"], ["metal_structures", "200", "1.5"]]);
  assert.equal(multi.procurementStorageTotal, "3.5");
  const partiallyClassified = calculateProcurementStorage(await calculate({
    ...multiPosition,
    resources: multiPosition.resources.map((entry, index) => ({
      ...entry, procurementCategory: index === 0 ? entry.procurementCategory : null,
    })),
  }), context, candidates);
  assert.equal(partiallyClassified.blocks[0]?.reason, "category");
  assert.equal(partiallyClassified.blocks[0]?.procurementCategory, null);
  assert.equal(partiallyClassified.complete, false);
  assert.equal(partiallyClassified.procurementStorageTotal, null);
  assert.equal(partiallyClassified.directPlusProcurement, null);

  const sameCategoryPosition: ResourcePricingPositionInput = {
    ...multiPosition,
    resources: multiPosition.resources.map((entry) => ({
      ...entry, procurementCategory: "construction_materials",
    })),
  };
  const safePrices = [...repository.candidates];
  for (const blockedState of ["price_semantics", "missing", "ambiguous"] as const) {
    const materialB = safePrices[1]!;
    repository.candidates = blockedState === "price_semantics"
      ? [safePrices[0]!, { ...materialB, vatTreatment: "unknown" }]
      : blockedState === "missing"
        ? [safePrices[0]!]
        : [...safePrices, { ...materialB, id: "duplicate-B", resourcePriceId: "duplicate-B" }];
    const partial = calculateProcurementStorage(
      await calculate(sameCategoryPosition), context, candidates,
    );
    assert.equal(partial.blocks.length, 1);
    assert.equal(partial.blocks[0]?.resourceId, resourceIds.unpriced);
    assert.equal(partial.blocks[0]?.procurementCategory, "construction_materials");
    assert.equal(partial.blocks[0]?.reason,
      blockedState === "price_semantics" ? "price_semantics" : "direct_price");
    assert.equal(partial.categories[0]?.materialBase, "100");
    assert.equal(partial.categories[0]?.resolution.status, "selected");
    assert.equal(partial.categories[0]?.application, null);
    assert.equal(partial.complete, false);
    assert.equal(partial.procurementStorageTotal, null);
    assert.equal(partial.directPlusProcurement, null);

    repository.candidates = [...safePrices];
    const restored = calculateProcurementStorage(
      await calculate(sameCategoryPosition), context, candidates,
    );
    assert.equal(restored.complete, true);
    assert.deepEqual(restored.blocks, []);
    assert.equal(restored.categories[0]?.materialBase, "300");
    assert.equal(restored.categories[0]?.application?.amount, "6");
    assert.equal(restored.procurementStorageTotal, "6");
    assert.equal(restored.directPlusProcurement, "306");
  }
  repository.candidates = [
    safePrices[0]!, { ...safePrices[1]!, vatTreatment: "unknown" },
    price(resourceIds.zero, { price: "400", vatTreatment: "exclusive", transportTreatment: "excluded" }),
  ];
  const separateCategory = calculateProcurementStorage(await calculate({
    ...sameCategoryPosition,
    resources: [
      ...sameCategoryPosition.resources,
      { ...line("METAL", resourceIds.zero, "material", "1", "kg"), procurementCategory: "metal_structures" },
    ],
  }), context, candidates);
  assert.equal(separateCategory.categories.find((entry) =>
    entry.category === "construction_materials")?.application, null);
  const independentMetal = separateCategory.categories.find((entry) =>
    entry.category === "metal_structures");
  assert.equal(independentMetal?.resolution.status, "selected");
  assert.equal(independentMetal?.materialBase, "400");
  assert.equal(independentMetal?.application?.amount, "3");
  assert.equal(separateCategory.complete, false);
  assert.equal(separateCategory.procurementStorageTotal, null);
  assert.equal(separateCategory.directPlusProcurement, null);

  repository.candidates = [];
  const unclassifiedUnpriced = calculateProcurementStorage(await calculate({
    ...sameCategoryPosition,
    resources: [line("UNCLASSIFIED", resourceIds.material, "material", "1", "kg")],
  }), context, candidates);
  assert.equal(unclassifiedUnpriced.blocks[0]?.reason, "category");
  assert.equal(unclassifiedUnpriced.blocks[0]?.procurementCategory, null);
  assert.equal(unclassifiedUnpriced.complete, false);
  assert.equal(unclassifiedUnpriced.procurementStorageTotal, null);
  assert.equal(unclassifiedUnpriced.directPlusProcurement, null);

  const empty = calculateProcurementStorage(
    await calculate({ ...classifiedPosition, resources: [] }), context, candidates,
  );
  assert.equal(empty.complete, false);
  assert.equal(empty.blocks[0]?.reason, "empty_composition");
  assert.equal(empty.blocks[0]?.procurementCategory, null);
  assert.equal(empty.directResourceTotal, null);
  assert.equal(empty.procurementStorageTotal, null);
  assert.equal(empty.directPlusProcurement, null);
  repository.candidates = [];
  const zero = calculateProcurementStorage(await calculate({
    ...classifiedPosition,
    resources: [line("ZERO-MAT", resourceIds.zero, "material", "0", "kg")],
  }), context, []);
  assert.equal(zero.complete, true);
  assert.deepEqual(zero.blocks, []);
  assert.deepEqual(zero.categories, []);
  assert.equal(zero.directResourceTotal, "0");
  assert.equal(zero.procurementStorageTotal, "0");
  assert.equal(zero.directPlusProcurement, "0");
  const noPositions = calculateProcurementStorage({
    positionsByWorkItemId: {}, positionCount: 0, completePositionCount: 0,
    requiredPriceCount: 0, pricedResourceCount: 0,
  }, context, candidates);
  assert.equal(noPositions.complete, false);
  assert.equal(noPositions.directPlusProcurement, null);
  assert.equal(calculateProcurementStorageAmount("0.123456", "0.75"), "0.00092592");
  assert.throws(() => calculateProcurementStorageAmount(99 as never, "2"));
  assert.throws(() => calculateProcurementStorageAmount("-1", "2"));
  assert.throws(() => calculateProcurementStorageAmount("99", "-2"));
  for (const file of [
    "domain/professional-estimates/calculation/procurement-storage.ts",
    "domain/professional-estimates/professional-resource-prices.service.ts",
    "infrastructure/db/repositories/professionalResourcePrices.repository.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /calculateProfessionalCostStack|not_applicable|sellingPrice|catalogItems|quoteItems/);
  }
}

console.log("Professional resource price register, direct-cost and procurement/storage checks passed.");
}

void main();
