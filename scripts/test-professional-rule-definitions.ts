import assert from "node:assert/strict";
import {
  ProfessionalRuleDefinitionService,
  mapRuleDefinitionToCandidate,
  validateRuleDefinitionInput,
} from "../domain/professional-estimates/professional-rule-definitions.service";
import { ProfessionalRuleDefinitionValidationError } from "../domain/professional-estimates/professional-rule-definitions.error";
import {
  resolveProfessionalRule,
  type ProfessionalRuleResolutionContext,
} from "../domain/professional-estimates/calculation";
import type {
  ApplicabilityDecisionForRule,
  CompanyCalculationRuleSourceRecord,
  CreateProfessionalRuleDefinitionInput,
  ProfessionalRuleDefinitionRecord,
  ProfessionalRuleDefinitionRepository,
} from "../domain/professional-estimates/professional-rule-definitions.repository";

/**
 * M8.3D domain/repository tests for the reusable professional rule library.
 * These use an in-memory repository (no database). All numeric values are
 * labelled fixtures, never current Moldovan default rates.
 */

type SeededDecision = ApplicabilityDecisionForRule & { organizationId: string };

class MemoryRuleDefinitionRepository
  implements ProfessionalRuleDefinitionRepository
{
  definitions: ProfessionalRuleDefinitionRecord[] = [];
  decisions: SeededDecision[] = [];
  createCalls = 0;
  companySource: CompanyCalculationRuleSourceRecord | null = null;

  async getCompanyCalculationRuleSource() {
    return this.companySource;
  }

  async insertCompanyCalculationRuleSourceIfAbsent(organizationId: string) {
    if (this.companySource) return null;
    this.companySource = {
      id: "10000000-0000-4000-8000-000000000001",
      organizationId,
      code: "DEVIZO-COMPANY-CALC-RULES",
      edition: "1",
      title: "Reguli interne de calcul ale companiei",
      sourceType: "company_custom",
      jurisdiction: "MD",
      status: "active",
      officialStatus: "unknown",
      monitoringEnabled: false,
    };
    return this.companySource;
  }

  async createRuleDefinition(
    input: CreateProfessionalRuleDefinitionInput,
  ): Promise<ProfessionalRuleDefinitionRecord> {
    this.createCalls += 1;
    const now = new Date("2026-10-12T00:00:00Z");
    const record: ProfessionalRuleDefinitionRecord = {
      id: `def-${this.definitions.length + 1}`,
      organizationId: input.organizationId,
      sourceId: input.sourceId,
      applicabilityDecisionId: input.applicabilityDecisionId ?? null,
      name: input.name,
      component: input.component,
      valueType: input.valueType,
      value: input.value,
      currency: input.currency ?? null,
      calculationBasis: input.calculationBasis,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      estimatePerspective: input.estimatePerspective,
      workKind: input.workKind,
      ruleOrigin: input.ruleOrigin,
      procurementCategory: input.procurementCategory ?? null,
      sourceReference: input.sourceReference ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.definitions.push(record);
    return record;
  }

  async getRuleDefinition(
    organizationId: string,
    id: string,
  ): Promise<ProfessionalRuleDefinitionRecord | null> {
    return (
      this.definitions.find(
        (d) => d.organizationId === organizationId && d.id === id,
      ) ?? null
    );
  }

  async listRuleDefinitionsForComponent(
    organizationId: string,
    component: ProfessionalRuleDefinitionRecord["component"],
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    return this.definitions.filter(
      (d) => d.organizationId === organizationId && d.component === component,
    );
  }

  async listRuleDefinitions(
    organizationId: string,
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    return this.definitions.filter(
      (definition) => definition.organizationId === organizationId,
    );
  }

  async listRuleDefinitionsForSource(
    organizationId: string,
    sourceId: string,
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    return this.definitions.filter(
      (d) => d.organizationId === organizationId && d.sourceId === sourceId,
    );
  }

  async getApplicabilityDecisionForSource(
    organizationId: string,
    sourceId: string,
    applicabilityDecisionId: string,
  ): Promise<ApplicabilityDecisionForRule | null> {
    const found = this.decisions.find(
      (d) =>
        d.organizationId === organizationId &&
        d.sourceId === sourceId &&
        d.id === applicabilityDecisionId,
    );
    if (!found) return null;
    return {
      id: found.id,
      sourceId: found.sourceId,
      decision: found.decision,
      applicableFrom: found.applicableFrom,
      applicableUntil: found.applicableUntil,
    };
  }
}

const ORG = "org-1";
const SOURCE = "source-1";
const UUID_ORG = "10000000-0000-4000-8000-000000000010";

function baseInput(
  overrides: Partial<CreateProfessionalRuleDefinitionInput> = {},
): CreateProfessionalRuleDefinitionInput {
  return {
    organizationId: ORG,
    sourceId: SOURCE,
    applicabilityDecisionId: "decision-1",
    name: "Sector-average overhead (fixture)",
    component: "overhead",
    valueType: "percent",
    value: "14.5", // fixture, not a default
    currency: null,
    calculationBasis: "direct_cost",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    estimatePerspective: "investor",
    workKind: "construction",
    ruleOrigin: "normative_sector_average",
    procurementCategory: null,
    sourceReference: "CP L.01.03-2012 (fixture)",
    notes: null,
    ...overrides,
  };
}

function applicableDecision(
  overrides: Partial<SeededDecision> = {},
): SeededDecision {
  return {
    id: "decision-1",
    organizationId: ORG,
    sourceId: SOURCE,
    decision: "applicable",
    applicableFrom: "2026-01-01",
    applicableUntil: null,
    ...overrides,
  };
}

function definitionRecord(
  overrides: Partial<ProfessionalRuleDefinitionRecord> = {},
): ProfessionalRuleDefinitionRecord {
  const now = new Date("2026-10-12T00:00:00Z");
  return {
    id: "seed-1",
    organizationId: ORG,
    sourceId: SOURCE,
    applicabilityDecisionId: "decision-1",
    name: "Seeded official overhead (fixture)",
    component: "overhead",
    valueType: "percent",
    value: "14.5", // fixture
    currency: null,
    calculationBasis: "direct_cost",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    estimatePerspective: "investor",
    workKind: "construction",
    ruleOrigin: "normative_sector_average",
    procurementCategory: null,
    sourceReference: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function expectError(code: string, run: () => Promise<unknown>): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(
      error instanceof ProfessionalRuleDefinitionValidationError,
      `expected ProfessionalRuleDefinitionValidationError, got ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });
}

async function main(): Promise<void> {
// Company rule source and definitions are organization-scoped and reusable.
{
  const repo = new MemoryRuleDefinitionRepository();
  const service = new ProfessionalRuleDefinitionService(repo);
  const source = await service.ensureCompanyCalculationRuleSource(UUID_ORG);
  assert.equal(source.code, "DEVIZO-COMPANY-CALC-RULES");
  assert.equal(source.edition, "1");
  assert.equal(source.sourceType, "company_custom");
  await service.ensureCompanyCalculationRuleSource(UUID_ORG);
  assert.equal(repo.companySource?.id, source.id);

  const created = await service.createCompanyRuleDefinition(UUID_ORG, {
    name: "Company labor fixture",
    component: "labor_contributions",
    valueType: "percent",
    value: "5",
    calculationBasis: "labor_cost",
    validFrom: "2026-01-01",
    estimatePerspective: "investor",
    workKind: "construction",
  });
  assert.equal(created.sourceId, source.id);
  assert.equal(created.ruleOrigin, "company_individual");
  assert.equal(created.applicabilityDecisionId, null);
  assert.equal(repo.decisions.length, 0);
  assert.equal(
    (await service.createCompanyRuleDefinition(UUID_ORG, {
      name: "Material percentage fixture",
      component: "material_transport",
      valueType: "percent",
      value: "10",
      calculationBasis: "material_cost",
      validFrom: "2026-01-01",
      estimatePerspective: "investor",
      workKind: "construction",
    })).calculationBasis,
    "material_cost",
  );
  assert.equal(
    (await service.createCompanyRuleDefinition(UUID_ORG, {
      name: "Fixed material transport fixture",
      component: "material_transport",
      valueType: "fixed_amount",
      value: "12.5",
      currency: "EUR",
      calculationBasis: "fixed_amount",
      validFrom: "2026-01-01",
      estimatePerspective: "investor",
      workKind: "construction",
    })).currency,
    "EUR",
  );
  for (const basis of ["direct_cost", "labor_cost"] as const) {
    assert.equal(
      (await service.createCompanyRuleDefinition(UUID_ORG, {
        name: `Overhead ${basis} fixture`,
        component: "overhead",
        valueType: "percent",
        value: "10",
        calculationBasis: basis,
        validFrom: "2026-01-01",
        estimatePerspective: "investor",
        workKind: "construction",
      })).calculationBasis,
      basis,
    );
  }
  assert.equal(
    (await service.createCompanyRuleDefinition(UUID_ORG, {
      name: "Estimated profit fixture",
      component: "estimated_profit",
      valueType: "percent",
      value: "5",
      calculationBasis: "estimate_cost_before_profit",
      validFrom: "2026-01-01",
      estimatePerspective: "investor",
      workKind: "construction",
    })).calculationBasis,
    "estimate_cost_before_profit",
  );

  await expectError("incompatible_rule_semantics", () =>
    service.createCompanyRuleDefinition(UUID_ORG, {
      name: "Invalid labor fixture",
      component: "labor_contributions",
      valueType: "percent",
      value: "5",
      calculationBasis: "direct_cost",
      validFrom: "2026-01-01",
      estimatePerspective: "investor",
      workKind: "construction",
    }),
  );
  await expectError("invalid_currency", () =>
    service.createCompanyRuleDefinition(UUID_ORG, {
      name: "Fixed transport without currency",
      component: "material_transport",
      valueType: "fixed_amount",
      value: "5",
      calculationBasis: "fixed_amount",
      validFrom: "2026-01-01",
      estimatePerspective: "investor",
      workKind: "construction",
    }),
  );
  await expectError("incompatible_rule_semantics", () =>
    service.createCompanyRuleDefinition(UUID_ORG, {
      name: "Invalid overhead basis",
      component: "overhead",
      valueType: "percent",
      value: "10",
      calculationBasis: "material_cost",
      validFrom: "2026-01-01",
      estimatePerspective: "investor",
      workKind: "construction",
    }),
  );
  await expectError("incompatible_rule_semantics", () =>
    service.createCompanyRuleDefinition(UUID_ORG, {
      name: "Invalid profit basis",
      component: "estimated_profit",
      valueType: "percent",
      value: "5",
      calculationBasis: "direct_cost",
      validFrom: "2026-01-01",
      estimatePerspective: "investor",
      workKind: "construction",
    }),
  );
  await expectError("invalid_component", () =>
    service.createCompanyRuleDefinition(UUID_ORG, {
      name: "No procurement rule",
      component: "procurement_storage",
      valueType: "percent",
      value: "2",
      calculationBasis: "material_cost",
      validFrom: "2026-01-01",
      estimatePerspective: "investor",
      workKind: "construction",
    }),
  );
  assert.equal(
    repo.definitions.some((definition) => definition.component === "procurement_storage"),
    false,
  );
}

// Source reads are scoped by both organization and source in the repository API.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.definitions.push(
    definitionRecord({ id: "source-a-rule", sourceId: "source-a" }),
    definitionRecord({ id: "source-b-rule", sourceId: "source-b" }),
    definitionRecord({
      id: "other-organization-rule",
      organizationId: "org-2",
      sourceId: "source-a",
    }),
  );
  const service = new ProfessionalRuleDefinitionService(repo);
  const result = await service.listRuleDefinitionsForSource(ORG, "source-a");
  assert.deepEqual(result.map((definition) => definition.id), ["source-a-rule"]);
}

// 1, 2, 3, 15. Valid official rule maps to a candidate; candidateId == row id;
// provenance preserved; no side-effect calculation_rules row exists.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.decisions.push(applicableDecision());
  const service = new ProfessionalRuleDefinitionService(repo);

  const created = await service.createRuleDefinition(baseInput());
  assert.equal(created.id, "def-1");
  assert.equal(repo.createCalls, 1);

  const candidate = mapRuleDefinitionToCandidate(created);
  assert.equal(candidate.candidateId, created.id);
  assert.equal(candidate.component, "overhead");
  assert.equal(candidate.sourceId, SOURCE);
  assert.equal(candidate.applicabilityDecisionId, "decision-1");
  assert.equal(candidate.sourceReference, "CP L.01.03-2012 (fixture)");
  // The reusable definition is not an applied calculation_rules row.
  assert.equal(candidate.calculationRuleId, null);
}

// 4. Official rule without applicabilityDecisionId is rejected (pure).
{
  const repo = new MemoryRuleDefinitionRepository();
  const service = new ProfessionalRuleDefinitionService(repo);
  await expectError("missing_applicability_decision", () =>
    service.createRuleDefinition(
      baseInput({ applicabilityDecisionId: null }),
    ),
  );
  assert.equal(repo.createCalls, 0);
}

// 5, 6, 7. Official rule linked to a non-applicable decision is rejected.
{
  for (const decision of ["not_applicable", "deferred", "unknown"] as const) {
    const repo = new MemoryRuleDefinitionRepository();
    repo.decisions.push(applicableDecision({ decision }));
    const service = new ProfessionalRuleDefinitionService(repo);
    await expectError("applicability_not_applicable", () =>
      service.createRuleDefinition(baseInput()),
    );
    assert.equal(repo.createCalls, 0);
  }
}

// 8. Source mismatch between definition and applicability decision is rejected
//    (the decision is not found for this source).
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.decisions.push(applicableDecision({ sourceId: "source-OTHER" }));
  const service = new ProfessionalRuleDefinitionService(repo);
  await expectError("applicability_decision_not_found", () =>
    service.createRuleDefinition(baseInput()),
  );
}

// 9. Rule validity before applicableFrom is rejected.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.decisions.push(applicableDecision({ applicableFrom: "2026-03-01" }));
  const service = new ProfessionalRuleDefinitionService(repo);
  await expectError("rule_before_applicable_from", () =>
    service.createRuleDefinition(baseInput({ validFrom: "2026-01-01" })),
  );
}

// 10. Rule validity beyond applicableUntil is rejected (and open-ended rule).
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.decisions.push(applicableDecision({ applicableUntil: "2026-06-30" }));
  const service = new ProfessionalRuleDefinitionService(repo);
  await expectError("rule_past_applicable_until", () =>
    service.createRuleDefinition(baseInput({ validTo: "2026-12-31" })),
  );

  const repo2 = new MemoryRuleDefinitionRepository();
  repo2.decisions.push(applicableDecision({ applicableUntil: "2026-06-30" }));
  const service2 = new ProfessionalRuleDefinitionService(repo2);
  await expectError("rule_open_ended_past_applicable_until", () =>
    service2.createRuleDefinition(baseInput({ validTo: null })),
  );
}

// 11. company_individual may exist without an applicabilityDecisionId.
{
  const repo = new MemoryRuleDefinitionRepository();
  const service = new ProfessionalRuleDefinitionService(repo);
  const created = await service.createRuleDefinition(
    baseInput({
      ruleOrigin: "company_individual",
      applicabilityDecisionId: null,
      name: "Company overhead (fixture)",
    }),
  );
  assert.equal(created.ruleOrigin, "company_individual");
  assert.equal(created.applicabilityDecisionId, null);
}

// 12, 13. contract_agreed may exist without a decision, and mapping to a
//         candidate does NOT bypass M8.3C explicit opt-in.
{
  const repo = new MemoryRuleDefinitionRepository();
  const service = new ProfessionalRuleDefinitionService(repo);
  const created = await service.createRuleDefinition(
    baseInput({
      component: "procurement_storage",
      calculationBasis: "material_cost",
      procurementCategory: "any",
      estimatePerspective: "contractor",
      workKind: "any",
      ruleOrigin: "contract_agreed",
      applicabilityDecisionId: null,
      name: "Contract storage (fixture)",
      value: "2", // fixture
    }),
  );
  const candidate = mapRuleDefinitionToCandidate(created);

  const context: ProfessionalRuleResolutionContext = {
    valuationDate: "2026-06-15",
    estimatePerspective: "contractor",
    workKind: "construction",
    currency: "MDL",
  };
  // Without explicit opt-in, the contract_agreed candidate must not resolve.
  const notOptedIn = resolveProfessionalRule(
    "procurement_storage",
    [candidate],
    context,
  );
  assert.equal(notOptedIn.status, "missing");

  const optedIn = resolveProfessionalRule("procurement_storage", [candidate], {
    ...context,
    restrictToOrigins: ["contract_agreed"],
  });
  assert.equal(optedIn.status, "selected");
  assert.equal(optedIn.candidate?.candidateId, created.id);
}

// 14. Decimal values remain strings through the mapper.
{
  const repo = new MemoryRuleDefinitionRepository();
  const service = new ProfessionalRuleDefinitionService(repo);
  const created = await service.createRuleDefinition(
    baseInput({
      ruleOrigin: "company_individual",
      applicabilityDecisionId: null,
      value: "0.123456",
    }),
  );
  const candidate = mapRuleDefinitionToCandidate(created);
  assert.equal(typeof candidate.value, "string");
  assert.equal(candidate.value, "0.123456");
}

// Load-time governance revalidation for official definitions.
// A. official definition linked to not_applicable is rejected on load.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.definitions.push(definitionRecord());
  repo.decisions.push(applicableDecision({ decision: "not_applicable" }));
  const service = new ProfessionalRuleDefinitionService(repo);
  await expectError("applicability_not_applicable", () =>
    service.loadCandidatesForComponent(ORG, "overhead"),
  );
}

// B. official definition linked to deferred is rejected on load.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.definitions.push(definitionRecord());
  repo.decisions.push(applicableDecision({ decision: "deferred" }));
  const service = new ProfessionalRuleDefinitionService(repo);
  await expectError("applicability_not_applicable", () =>
    service.loadCandidatesForComponent(ORG, "overhead"),
  );
}

// C. official definition starting before applicableFrom is rejected on load.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.definitions.push(definitionRecord({ validFrom: "2026-01-01" }));
  repo.decisions.push(applicableDecision({ applicableFrom: "2026-03-01" }));
  const service = new ProfessionalRuleDefinitionService(repo);
  await expectError("rule_before_applicable_from", () =>
    service.loadCandidatesForComponent(ORG, "overhead"),
  );
}

// D. official definition extending beyond applicableUntil is rejected on load.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.definitions.push(definitionRecord({ validTo: "2026-12-31" }));
  repo.decisions.push(applicableDecision({ applicableUntil: "2026-06-30" }));
  const service = new ProfessionalRuleDefinitionService(repo);
  await expectError("rule_past_applicable_until", () =>
    service.loadCandidatesForComponent(ORG, "overhead"),
  );

  // Open-ended rule against a finite applicableUntil is also rejected on load.
  const repo2 = new MemoryRuleDefinitionRepository();
  repo2.definitions.push(definitionRecord({ validTo: null }));
  repo2.decisions.push(applicableDecision({ applicableUntil: "2026-06-30" }));
  const service2 = new ProfessionalRuleDefinitionService(repo2);
  await expectError("rule_open_ended_past_applicable_until", () =>
    service2.loadCandidatesForComponent(ORG, "overhead"),
  );

  // A missing linked decision is rejected on load, not silently skipped.
  const repo3 = new MemoryRuleDefinitionRepository();
  repo3.definitions.push(definitionRecord());
  const service3 = new ProfessionalRuleDefinitionService(repo3);
  await expectError("applicability_decision_not_found", () =>
    service3.loadCandidatesForComponent(ORG, "overhead"),
  );
}

// E. a valid official definition still maps normally on load.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.definitions.push(definitionRecord({ id: "official-valid" }));
  repo.decisions.push(applicableDecision());
  const service = new ProfessionalRuleDefinitionService(repo);
  const candidates = await service.loadCandidatesForComponent(ORG, "overhead");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.candidateId, "official-valid");
  assert.equal(candidates[0]?.calculationRuleId, null);
}

// F. company_individual and contract_agreed are not re-gated on load.
{
  const repo = new MemoryRuleDefinitionRepository();
  repo.definitions.push(
    definitionRecord({
      id: "company-rule",
      ruleOrigin: "company_individual",
      applicabilityDecisionId: null,
    }),
    definitionRecord({
      id: "contract-rule",
      ruleOrigin: "contract_agreed",
      applicabilityDecisionId: null,
    }),
  );
  // No decisions seeded on purpose; these origins need no official gate.
  const service = new ProfessionalRuleDefinitionService(repo);
  const candidates = await service.loadCandidatesForComponent(ORG, "overhead");
  assert.equal(candidates.length, 2);
  assert.deepEqual(
    candidates.map((c) => c.candidateId).sort(),
    ["company-rule", "contract-rule"],
  );
}

// Pure input validation rejects shapes the cost stack cannot apply.
{
  assert.throws(
    () =>
      validateRuleDefinitionInput(
        baseInput({
          ruleOrigin: "company_individual",
          applicabilityDecisionId: null,
          calculationBasis: "labor_cost", // overhead+labor is valid...
          component: "estimated_profit", // ...but not for estimated_profit
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ProfessionalRuleDefinitionValidationError);
      assert.equal(error.code, "incompatible_rule_semantics");
      return true;
    },
  );
  // percent carrying a currency is rejected.
  assert.throws(
    () =>
      validateRuleDefinitionInput(
        baseInput({
          ruleOrigin: "company_individual",
          applicabilityDecisionId: null,
          currency: "MDL",
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ProfessionalRuleDefinitionValidationError);
      assert.equal(error.code, "unexpected_currency");
      return true;
    },
  );
  // procurement category on a non-procurement component is rejected.
  assert.throws(
    () =>
      validateRuleDefinitionInput(
        baseInput({
          ruleOrigin: "company_individual",
          applicabilityDecisionId: null,
          procurementCategory: "equipment",
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ProfessionalRuleDefinitionValidationError);
      assert.equal(error.code, "unexpected_procurement_category");
      return true;
    },
  );
}

console.log("Professional rule definition checks passed.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
