import assert from "node:assert/strict";
import {
  resolveProfessionalRule,
} from "../domain/professional-estimates/calculation";
import type {
  ProfessionalCostComponentDecisionRecord,
  ProfessionalCostComponentDecisionRepository,
  UpsertProfessionalCostComponentDecisionInput,
} from "../domain/professional-estimates/professional-cost-component-decisions.repository";
import {
  isStoredCostComponentDecisionStale,
  ProfessionalCostComponentDecisionError,
  ProfessionalCostComponentDecisionService,
} from "../domain/professional-estimates/professional-cost-component-decisions.service";
import type {
  ApplicabilityDecisionForRule,
  CreateProfessionalRuleDefinitionInput,
  ProfessionalRuleDefinitionRecord,
  ProfessionalRuleDefinitionRepository,
} from "../domain/professional-estimates/professional-rule-definitions.repository";
import { ProfessionalRuleDefinitionService } from "../domain/professional-estimates/professional-rule-definitions.service";

const ORG_A = "10000000-0000-4000-8000-000000000010";
const ORG_B = "20000000-0000-4000-8000-000000000020";
const CONTEXT_A = "30000000-0000-4000-8000-000000000030";
const CONTEXT_B = "40000000-0000-4000-8000-000000000040";
const SOURCE_A = "50000000-0000-4000-8000-000000000050";
const SOURCE_B = "60000000-0000-4000-8000-000000000060";
const RULE_A = "70000000-0000-4000-8000-000000000070";
const RULE_B = "80000000-0000-4000-8000-000000000080";
const RULE_C = "a0000000-0000-4000-8000-0000000000a0";
const OTHER_ORG_RULE = "90000000-0000-4000-8000-000000000090";

class MemoryRuleRepository implements ProfessionalRuleDefinitionRepository {
  readonly definitions: ProfessionalRuleDefinitionRecord[] = [];
  private readonly sources = new Map<
    string,
    { id: string; code: string; edition: string; sourceType: string }
  >();
  ensureCalls = 0;

  async ensureCompanyCalculationRuleSource(organizationId: string) {
    this.ensureCalls += 1;
    const existing = this.sources.get(organizationId);
    if (existing) return existing;
    const source = {
      id: organizationId === ORG_A ? SOURCE_A : SOURCE_B,
      code: "DEVIZO-COMPANY-CALC-RULES",
      edition: "1",
      sourceType: "company_custom",
    };
    this.sources.set(organizationId, source);
    return source;
  }

  async createRuleDefinition(
    input: CreateProfessionalRuleDefinitionInput,
  ): Promise<ProfessionalRuleDefinitionRecord> {
    const id =
      input.organizationId === ORG_A
        ? [RULE_A, RULE_B, RULE_C][
            this.definitions.filter((row) => row.organizationId === ORG_A).length
          ] ?? RULE_C
        : OTHER_ORG_RULE;
    const now = new Date("2026-10-19T00:00:00.000Z");
    const record: ProfessionalRuleDefinitionRecord = {
      id,
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

  async getRuleDefinition(org: string, id: string) {
    return this.definitions.find((row) => row.organizationId === org && row.id === id) ?? null;
  }

  async listRuleDefinitionsForComponent(org: string, component: ProfessionalRuleDefinitionRecord["component"]) {
    return this.definitions.filter(
      (row) => row.organizationId === org && row.component === component,
    );
  }

  async listRuleDefinitions(org: string) {
    return this.definitions.filter((row) => row.organizationId === org);
  }

  async listRuleDefinitionsForSource(org: string, source: string) {
    return this.definitions.filter(
      (row) => row.organizationId === org && row.sourceId === source,
    );
  }

  async getApplicabilityDecisionForSource(
    organizationId: string,
    sourceId: string,
    applicabilityDecisionId: string,
  ): Promise<ApplicabilityDecisionForRule | null> {
    void organizationId;
    void sourceId;
    void applicabilityDecisionId;
    return null;
  }
}

class MemoryDecisionRepository implements ProfessionalCostComponentDecisionRepository {
  readonly contexts = new Map([
    [CONTEXT_A, ORG_A],
    [CONTEXT_B, ORG_B],
  ]);
  records: ProfessionalCostComponentDecisionRecord[] = [];
  upsertCalls = 0;
  deleteCalls = 0;

  constructor(private readonly rules: MemoryRuleRepository) {}

  async listForContext(org: string, context: string) {
    if (this.contexts.get(context) !== org) return [];
    return this.records.filter(
      (record) =>
        record.organizationId === org && record.calculationContextId === context,
    );
  }

  async upsert(input: UpsertProfessionalCostComponentDecisionInput) {
    if (this.contexts.get(input.calculationContextId) !== input.organizationId) {
      throw new ProfessionalCostComponentDecisionError(
        "Contextul de calcul nu aparține companiei curente.",
      );
    }
    if (
      input.professionalRuleDefinitionId &&
      !this.rules.definitions.some(
        (rule) =>
          rule.id === input.professionalRuleDefinitionId &&
          rule.organizationId === input.organizationId,
      )
    ) {
      throw new ProfessionalCostComponentDecisionError(
        "Regula selectată nu aparține companiei curente.",
      );
    }
    this.upsertCalls += 1;
    const existing = this.records.find(
      (record) =>
        record.organizationId === input.organizationId &&
        record.calculationContextId === input.calculationContextId &&
        record.component === input.component,
    );
    const now = new Date("2026-10-19T00:00:00.000Z");
    const record: ProfessionalCostComponentDecisionRecord = {
      id: existing?.id ?? `decision-${this.records.length + 1}`,
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) {
      this.records = this.records.map((row) => row.id === existing.id ? record : row);
    } else {
      this.records.push(record);
    }
    return record;
  }
}

const ruleRepo = new MemoryRuleRepository();
const ruleService = new ProfessionalRuleDefinitionService(ruleRepo);
const decisionRepo = new MemoryDecisionRepository(ruleRepo);
const decisionService = new ProfessionalCostComponentDecisionService(
  decisionRepo,
  ruleService,
);
const context = {
  valuationDate: "2026-06-15",
  currency: "MDL",
  estimatePerspective: "investor" as const,
  workKind: "construction" as const,
};

async function expectDecisionError(run: () => Promise<unknown>): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof ProfessionalCostComponentDecisionError);
    return true;
  });
}

async function main(): Promise<void> {
  // No decision remains unresolved; missing candidates do not create NA rows.
  assert.deepEqual(await decisionService.listForContext(ORG_A, CONTEXT_A), []);
  assert.equal(
    resolveProfessionalRule("labor_contributions", [], context).status,
    "missing",
  );

  // Source identity is company-scoped and stable across repeated creation.
  const sourceA = await ruleService.ensureCompanyCalculationRuleSource(ORG_A);
  assert.deepEqual(
    await ruleService.ensureCompanyCalculationRuleSource(ORG_A),
    sourceA,
  );
  assert.equal(sourceA.code, "DEVIZO-COMPANY-CALC-RULES");
  assert.equal(sourceA.edition, "1");
  assert.equal(sourceA.sourceType, "company_custom");
  assert.notEqual(
    (await ruleService.ensureCompanyCalculationRuleSource(ORG_B)).id,
    sourceA.id,
  );

  const first = await ruleService.createCompanyRuleDefinition(ORG_A, {
    name: "Internal labor A",
    component: "labor_contributions",
    valueType: "percent",
    value: "5",
    calculationBasis: "labor_cost",
    validFrom: "2012-08-17",
    estimatePerspective: "investor",
    workKind: "construction",
  });
  assert.equal(first.ruleOrigin, "company_individual");
  assert.equal(first.applicabilityDecisionId, null);
  const second = await ruleService.createCompanyRuleDefinition(ORG_A, {
    name: "Internal labor B",
    component: "labor_contributions",
    valueType: "percent",
    value: "6",
    calculationBasis: "labor_cost",
    validFrom: "2012-08-17",
    estimatePerspective: "investor",
    workKind: "construction",
  });
  const ambiguous = resolveProfessionalRule(
    "labor_contributions",
    await ruleService.loadCandidatesForComponent(ORG_A, "labor_contributions"),
    context,
  );
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.eligibleCandidates.length, 2);

  await expectDecisionError(() =>
    decisionService.saveDecision(ORG_A, CONTEXT_A, context, {
      component: "labor_contributions",
      decision: "applied",
    }),
  );
  await expectDecisionError(() =>
    decisionService.saveDecision(ORG_A, CONTEXT_A, context, {
      component: "labor_contributions",
      decision: "applied",
      professionalRuleDefinitionId: OTHER_ORG_RULE,
    }),
  );

  // A human may choose one eligible candidate; no hidden ranking is involved.
  const applied = await decisionService.saveDecision(ORG_A, CONTEXT_A, context, {
    component: "labor_contributions",
    decision: "applied",
    professionalRuleDefinitionId: second.id,
  });
  assert.equal(applied.professionalRuleDefinitionId, RULE_B);
  const decisionId = applied.id;
  assert.equal(
    isStoredCostComponentDecisionStale(applied, ambiguous.eligibleCandidates.map((candidate) => candidate.candidateId)),
    false,
  );

  // Changes to perspective or valuation date make a stored selection stale;
  // attempting to save the old choice again is rejected by fresh resolution.
  const contractorCandidates = await ruleService.loadCandidatesForComponent(
    ORG_A,
    "labor_contributions",
  );
  const contractorResolution = resolveProfessionalRule(
    "labor_contributions",
    contractorCandidates,
    { ...context, estimatePerspective: "contractor" },
  );
  assert.equal(contractorResolution.status, "missing");
  assert.equal(
    isStoredCostComponentDecisionStale(
      applied,
      contractorResolution.eligibleCandidates.map((candidate) => candidate.candidateId),
    ),
    true,
  );
  const historicalResolution = resolveProfessionalRule(
    "labor_contributions",
    await ruleService.loadCandidatesForComponent(ORG_A, "labor_contributions"),
    { ...context, valuationDate: "2010-01-01" },
  );
  assert.equal(historicalResolution.status, "missing");
  assert.equal(
    isStoredCostComponentDecisionStale(
      applied,
      historicalResolution.eligibleCandidates.map((candidate) => candidate.candidateId),
    ),
    true,
  );
  await expectDecisionError(() =>
    decisionService.saveDecision(
      ORG_A,
      CONTEXT_A,
      { ...context, estimatePerspective: "contractor" },
      {
        component: "labor_contributions",
        decision: "applied",
        professionalRuleDefinitionId: second.id,
      },
    ),
  );
  await expectDecisionError(() =>
    decisionService.saveDecision(
      ORG_A,
      CONTEXT_A,
      { ...context, valuationDate: "2010-01-01" },
      {
        component: "labor_contributions",
        decision: "applied",
        professionalRuleDefinitionId: second.id,
      },
    ),
  );

  await expectDecisionError(() =>
    decisionService.saveDecision(ORG_A, CONTEXT_A, context, {
      component: "labor_contributions",
      decision: "not_applicable",
      reason: " ",
    }),
  );
  const notApplicable = await decisionService.saveDecision(
    ORG_A,
    CONTEXT_A,
    context,
    {
      component: "labor_contributions",
      decision: "not_applicable",
      professionalRuleDefinitionId: null,
      reason: " Company has no applicable labor contribution for this scope. ",
    },
  );
  assert.equal(notApplicable.id, decisionId);
  assert.equal(notApplicable.professionalRuleDefinitionId, null);
  assert.equal(
    notApplicable.reason,
    " Company has no applicable labor contribution for this scope. ",
  );
  const changedBack = await decisionService.saveDecision(
    ORG_A,
    CONTEXT_A,
    context,
    {
      component: "labor_contributions",
      decision: "applied",
      professionalRuleDefinitionId: first.id,
    },
  );
  assert.equal(changedBack.id, decisionId);
  assert.equal(changedBack.professionalRuleDefinitionId, RULE_A);
  assert.equal(decisionRepo.deleteCalls, 0);

  await expectDecisionError(() =>
    decisionService.saveDecision(ORG_A, CONTEXT_B, context, {
      component: "labor_contributions",
      decision: "not_applicable",
      reason: "Cross-company test",
    }),
  );

  await ruleService.createCompanyRuleDefinition(ORG_A, {
    name: "Internal fixed material transport",
    component: "material_transport",
    valueType: "fixed_amount",
    value: "7.25",
    currency: "MDL",
    calculationBasis: "fixed_amount",
    validFrom: "2012-08-17",
    estimatePerspective: "investor",
    workKind: "construction",
  });
  assert.equal(decisionRepo.upsertCalls, 3);
}

void main()
  .then(() => console.log("Professional cost component decision checks passed."))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
