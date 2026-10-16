import assert from "node:assert/strict";
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
      price: "0",
      basisQuantity: "1.25",
      currency: "MDL",
      validFrom: "2026-01-01",
      sourceType: "manual",
    },
  );
  assert.equal(validPrice.price, "0");
  assert.equal(validPrice.sourceId, null);

  const invalidInputs: CreateResourcePriceData[] = [
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
      service.createResourcePrice(organizationId, resourceIds.labor, input),
      ProfessionalResourcePriceValidationError,
    );
  }
}

console.log("Professional resource price register and direct-cost checks passed.");
}

void main();
