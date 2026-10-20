import assert from "node:assert/strict";
import Module from "node:module";
import { calculateResourceLine } from "../domain/professional-estimates/calculation/resource-calculation";
import { ProfessionalRuleDefinitionService } from "../domain/professional-estimates/professional-rule-definitions.service";
import { ProfessionalCostComponentDecisionService } from "../domain/professional-estimates/professional-cost-component-decisions.service";
import type { ProfessionalCostComponentDecisionRecord } from "../domain/professional-estimates/professional-cost-component-decisions.repository";
import { ProfessionalEstimateWorkspaceService } from "../domain/professional-estimates/professional-estimate-workspace.service";
import type {
  ProfessionalEstimateWorkspace,
  ProfessionalEstimateWorkspaceRepository,
} from "../domain/professional-estimates/professional-estimate-workspace.repository";
import type { NormWorkspacePresentation } from "../domain/professional-estimates/professional-norm-library.service";
import type { DirectResourceCostPresentation } from "../domain/professional-estimates/professional-resource-prices.service";
import type { ResourcePriceCandidateRecord } from "../domain/professional-estimates/professional-resource-prices.repository";
import type { ProfessionalRuleDefinitionRecord } from "../domain/professional-estimates/professional-rule-definitions.repository";
import { ProfessionalObjectEstimateService } from "../domain/professional-estimates/professional-object-estimate.service";
import type { ProfessionalObjectEstimateWorkspaceRecord } from "../domain/professional-estimates/professional-object-estimate.repository";

async function testProfessionalContextRoundTrip(): Promise<void> {
  const org = "10000000-0000-4000-8000-000000000001";
  const contextId = "20000000-0000-4000-8000-000000000001";
  const objectId = "30000000-0000-4000-8000-000000000001";
  const objectEstimateId = "40000000-0000-4000-8000-000000000001";
  const now = new Date("2026-10-15T00:00:00Z");
  const workspace: ProfessionalEstimateWorkspace = {
    context: {
      id: contextId, organizationId: org, name: "Local fixture",
      valuationDate: "2026-10-15", currency: "MDL", method: "resource",
      estimatePerspective: "investor", workKind: "construction",
    },
    constructionObject: {
      id: objectId, name: "Object fixture", code: null, address: null, description: null,
    },
    workQuantityList: {
      id: "quantity-list", name: "List", revision: 1,
      sourceReference: null, sourceDate: null, description: null,
    },
    items: [{
      id: "work-item", organizationId: org, workQuantityListId: "quantity-list",
      positionNumber: 1, code: null, description: "Work", unit: "m2",
      quantity: "1", notes: null,
    }],
  };
  const ruleInputs: Array<Pick<ProfessionalRuleDefinitionRecord, "component" | "value" | "calculationBasis">> = [
    { component: "labor_contributions", value: "5", calculationBasis: "labor_cost" },
    { component: "material_transport", value: "10", calculationBasis: "material_cost" },
    { component: "overhead", value: "10", calculationBasis: "direct_cost" },
    { component: "estimated_profit", value: "5", calculationBasis: "estimate_cost_before_profit" },
    { component: "procurement_storage", value: "2", calculationBasis: "material_cost" },
  ];
  const rules: ProfessionalRuleDefinitionRecord[] = ruleInputs.map(({ component, value, calculationBasis }, index) => ({
    id: `50000000-0000-4000-8000-00000000000${index}`,
    organizationId: org, sourceId: "fixture-source",
    name: `Fixture ${component}`, component, value, calculationBasis,
    applicabilityDecisionId: null, valueType: "percent", currency: null,
    validFrom: "2026-01-01", validTo: null,
    estimatePerspective: "investor", workKind: "construction",
    ruleOrigin: "company_individual",
    procurementCategory: component === "procurement_storage" ? "construction_materials" : null,
    sourceReference: "Technical fixture only", notes: null,
    createdAt: now, updatedAt: now,
  }));
  const decisions: ProfessionalCostComponentDecisionRecord[] = rules
    .filter((rule) => rule.component !== "procurement_storage")
    .map((rule, index) => {
      if (rule.component === "procurement_storage") throw new Error("Not an explicit component");
      return {
        id: `60000000-0000-4000-8000-00000000000${index}`,
        organizationId: org, calculationContextId: contextId,
        component: rule.component,
        decision: "applied", professionalRuleDefinitionId: rule.id, reason: null,
        createdAt: now, updatedAt: now,
      };
    });
  const originalDecisions = structuredClone(decisions);
  let decisionWrites = 0;
  let contextWrites = 0;
  const ruleService = new ProfessionalRuleDefinitionService({
    async listRuleDefinitionsForComponent(organizationId, component) {
      assert.equal(organizationId, org);
      return rules.filter((rule) => rule.component === component);
    },
    async listRuleDefinitions(organizationId) {
      assert.equal(organizationId, org);
      return rules;
    },
    async getCompanyCalculationRuleSource() { return null; },
    async insertCompanyCalculationRuleSourceIfAbsent() { throw new Error("Unexpected source write"); },
    async createRuleDefinition() { throw new Error("Unexpected rule write"); },
    async getRuleDefinition(organizationId, id) {
      return rules.find((rule) => rule.organizationId === organizationId && rule.id === id) ?? null;
    },
    async listRuleDefinitionsForSource() { return rules; },
    async getApplicabilityDecisionForSource() { return null; },
  });
  const decisionService = new ProfessionalCostComponentDecisionService({
    async listForContext(organizationId, calculationContextId) {
      assert.equal(organizationId, org);
      assert.equal(calculationContextId, contextId);
      return structuredClone(decisions);
    },
    async upsert() {
      decisionWrites++;
      throw new Error("Context changes must not rewrite explicit decisions.");
    },
  }, ruleService);
  const summary = () => ({
    context: workspace.context,
    constructionObject: workspace.constructionObject,
    workQuantityList: workspace.workQuantityList,
    itemCount: 1,
  });
  const workspaceRepository: ProfessionalEstimateWorkspaceRepository = {
    async getProfessionalEstimate(organizationId, calculationContextId) {
      assert.equal(organizationId, org);
      assert.equal(calculationContextId, contextId);
      return structuredClone(workspace);
    },
    async listProfessionalEstimates() { return [summary()]; },
    async updateCalculationContext(organizationId, calculationContextId, data) {
      assert.equal(organizationId, org);
      assert.equal(calculationContextId, contextId);
      workspace.context = { ...workspace.context, ...data };
      contextWrites++;
      return true;
    },
    async createProfessionalEstimate() { throw new Error("Unexpected create"); },
    async createWorkQuantityItem() { throw new Error("Unexpected create"); },
    async updateWorkQuantityItem() { throw new Error("Unexpected update"); },
  };
  const workspaceService = new ProfessionalEstimateWorkspaceService(workspaceRepository);
  const materialPrice: ResourcePriceCandidateRecord = {
    id: "material-price", resourcePriceId: "material-price",
    organizationId: org, resourceId: "material", sourceId: null,
    price: "99", basisQuantity: "1", priceBasisQuantity: "1",
    currency: "MDL", validFrom: "2026-01-01", validTo: null,
    sourceType: "manual", sourceReference: null, location: null,
    vatTreatment: "exclusive", transportTreatment: "excluded", createdAt: now,
  };
  const pricing: DirectResourceCostPresentation = {
    positionCount: 1, completePositionCount: 1, requiredPriceCount: 3, pricedResourceCount: 3,
    positionsByWorkItemId: {
      "work-item": {
        workQuantityItemId: "work-item", complete: true,
        requiredPriceCount: 3, pricedResourceCount: 3, directResourceTotal: "4224",
        totalsByResourceType: {
          labor: "2750", material: "99", machinery: "1375",
          transport: "0", energy: "0", other: "0",
        },
        resources: [{
          id: "material-consumption", code: null, name: "Material",
          resourceId: "material", resourceType: "material",
          procurementCategory: "construction_materials", unit: "unit",
          resourceQuantity: "1", priceStatus: "selected", eligiblePriceCount: 1,
          selectedPrice: materialPrice, eligibility: null,
          calculation: calculateResourceLine({
            estimateNormVersionId: "norm-version", resourceConsumptionId: "material-consumption",
            resourceId: "material", resourcePriceId: materialPrice.id,
            normApplicationId: "application", resourceType: "material", currency: "MDL",
            workQuantity: "1", normBasisQuantity: "1", normativeConsumption: "1",
            applicationCoefficient: "1", resourcePrice: "99", priceBasisQuantity: "1",
          }),
        }],
      },
    },
  };
  const normPresentation: NormWorkspacePresentation = {
    itemCount: 1, assignedCount: 1, assignedByWorkItemId: {}, eligibleByWorkItemId: {},
  };
  const originalModules = new Map<string, NodeModule | undefined>();
  function replaceModule(path: string, exports: object) {
    const resolved = require.resolve(path);
    originalModules.set(resolved, require.cache[resolved]);
    const replacement = new Module(resolved);
    replacement.exports = exports;
    require.cache[resolved] = replacement;
  }

  const revalidated: Array<[string, string | undefined]> = [];
  replaceModule("../server/container", {
    getProfessionalEstimateWorkspaceService: () => workspaceService,
    getProfessionalCostComponentDecisionService: () => decisionService,
    getProfessionalRuleDefinitionService: () => ruleService,
    getProfessionalNormLibraryService: () => ({
      getNormWorkspacePresentation: async () => normPresentation,
    }),
    getProfessionalResourcePricesService: () => ({
      calculateDirectResourceCosts: async () => pricing,
    }),
  });
  replaceModule("../lib/auth/current-org", {
    requireCurrentOrg: async () => ({ org: { id: org } }),
  });
  replaceModule("../infrastructure/db", { db: {} });
  replaceModule("next/cache", {
    revalidatePath: (path: string, type?: string) => revalidated.push([path, type]),
  });
  for (const path of [
    "../app/(app)/professional-estimates/actions",
    "../server/professionalEstimateCalculation",
  ]) {
    const resolved = require.resolve(path);
    originalModules.set(resolved, require.cache[resolved]);
    delete require.cache[resolved];
  }
  try {
    const { getProfessionalEstimateCalculation } = await import("../server/professionalEstimateCalculation");
    const { updateCalculationContext } = await import("../app/(app)/professional-estimates/actions");
    const localCalculation = async () => getProfessionalEstimateCalculation(
      org, await workspaceService.getProfessionalEstimate(org, contextId),
    );
    const objectRow: ProfessionalObjectEstimateWorkspaceRecord = {
      estimate: {
        id: objectEstimateId, organizationId: org, constructionObjectId: objectId,
        name: "Object estimate", code: null, notes: null,
        valuationDate: "2026-10-15", currency: "MDL", createdAt: now, updatedAt: now,
      },
      constructionObjectName: workspace.constructionObject.name,
      entries: [{
        id: "object-entry", organizationId: org, objectEstimateId,
        calculationContextId: contextId, positionNumber: 1,
        costCategory: "construction_works", included: true, notes: null,
        createdAt: now, updatedAt: now,
      }],
    };
    const originalEntries = structuredClone(objectRow.entries);
    const objectService = new ProfessionalObjectEstimateService({
      async list() { return [objectRow]; },
      async get() { return objectRow; },
      async listConstructionObjects() { return [workspace.constructionObject]; },
      async constructionObjectExists() { return true; },
      async create() { throw new Error("Unexpected create"); },
      async addEntry() { throw new Error("Must not relink local estimate"); },
      async updateEntry() { throw new Error("Must not reselect category"); },
    }, async () => [summary()], async () => {
      const calculation = await localCalculation();
      return {
        calculationContextId: contextId, constructionObjectId: objectId,
        name: workspace.context.name, valuationDate: workspace.context.valuationDate,
        currency: workspace.context.currency,
        complete: calculation.stackResult !== null,
        subtotal: calculation.stackResult?.estimateSubtotalBeforeLimitedCostsAndVat ?? null,
      };
    });
    async function assertStage(complete: boolean) {
      const calculation = await localCalculation();
      assert.equal(calculation.stackResult?.estimateSubtotalBeforeLimitedCostsAndVat ?? null,
        complete ? "5051.2539" : null);
      for (const decision of decisions) {
        assert.equal(calculation.savedFor(decision.component)?.id, decision.id);
        assert.equal(calculation.isSavedDecisionStale(decision.component), !complete);
      }
      const detail = await objectService.get(org, objectEstimateId);
      const [listItem] = await objectService.list(org);
      assert.equal(detail.complete, complete);
      assert.equal(listItem?.complete, complete);
      if (complete) {
        assert.equal(detail.totals?.total, "5051.2539");
        assert.equal(listItem?.total, "5051.2539");
      } else {
        assert.equal(detail.totals, null);
        assert.equal(listItem?.total, null);
      }
      assert.deepEqual(decisions, originalDecisions);
      assert.deepEqual(objectRow.entries, originalEntries);
      assert.equal(decisionWrites, 0);
    }
    await assertStage(true);
    for (const perspective of ["contractor", "investor"]) {
      revalidated.length = 0;
      const formData = new FormData();
      formData.set("estimatePerspective", perspective);
      formData.set("workKind", "construction");
      assert.deepEqual(await updateCalculationContext(contextId, null, formData),
        { success: "Contextul de calcul a fost salvat." });
      assert.equal(workspace.context.estimatePerspective, perspective);
      assert.ok(revalidated.some(([path]) => path === `/professional-estimates/${contextId}`));
      assert.ok(revalidated.some(([path]) => path === "/professional-estimates/object-estimates"));
      assert.ok(revalidated.some(([path, type]) =>
        path === "/professional-estimates/object-estimates/[objectEstimateId]" && type === "page"));
      await assertStage(perspective === "investor");
    }
    assert.equal(contextWrites, 2);

    // An eligible alternative is not permission to replace an explicit choice.
    const savedRule = rules[0]!;
    rules.push({ ...savedRule, id: "70000000-0000-4000-8000-000000000001" });
    let calculation = await localCalculation();
    assert.equal(calculation.eligibleFor("labor_contributions").length, 2);
    assert.equal(calculation.stackResult?.estimateSubtotalBeforeLimitedCostsAndVat, "5051.2539");
    savedRule.validTo = "2026-10-14";
    calculation = await localCalculation();
    assert.equal(calculation.stackResult, null);
    assert.equal(calculation.isSavedDecisionStale("labor_contributions"), true);
    savedRule.validTo = null;
    const savedDecision = decisions.shift()!;
    calculation = await localCalculation();
    assert.equal(calculation.stackResult, null, "ambiguity without an explicit decision stays incomplete");
    rules.pop();
    calculation = await localCalculation();
    assert.equal(calculation.stackResult, null, "one eligible rule still requires an explicit choice");
    decisions.unshift(savedDecision);
    await assertStage(true);
  } finally {
    for (const [path, original] of originalModules) {
      if (original) require.cache[path] = original;
      else delete require.cache[path];
    }
  }
}

testProfessionalContextRoundTrip().then(() => {
  console.log("Professional context round-trip, explicit decisions, live object totals, and revalidation passed.");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
