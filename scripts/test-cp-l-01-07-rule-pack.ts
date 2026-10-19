import assert from "node:assert/strict";
import {
  CpL010720112RulePackInstaller,
  CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
  CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
  CP_L_01_07_2012_RULE_PACK,
  CP_L_01_07_2012_SOURCE_CODE,
  CP_L_01_07_2012_SOURCE_EDITION,
  type NormativeSourceReader,
} from "../domain/professional-estimates/official-rule-packs/cp-l-01-07-2012";
import { OfficialRulePackError } from "../domain/professional-estimates/official-rule-packs/official-rule-pack.error";
import { ProfessionalRuleDefinitionValidationError } from "../domain/professional-estimates/professional-rule-definitions.error";
import { ProfessionalRuleDefinitionService } from "../domain/professional-estimates/professional-rule-definitions.service";
import {
  calculateCpL0107Preview,
  CpL0107PreviewValidationError,
} from "../domain/professional-estimates/cp-l-01-07-preview";
import {
  calculateProfessionalCostStack,
  calculateResources,
  resolveProfessionalRule,
  type ProfessionalCostStackInput,
  type ProfessionalRuleCandidate,
  type ProfessionalRuleResolutionContext,
} from "../domain/professional-estimates/calculation";
import type {
  ApplicabilityDecisionForRule,
  CreateProfessionalRuleDefinitionInput,
  ProfessionalRuleDefinitionRecord,
  ProfessionalRuleDefinitionRepository,
} from "../domain/professional-estimates/professional-rule-definitions.repository";

/**
 * M8.3E integration tests for the first official rule pack (CP L.01.07-2012).
 * No database: an in-memory rule-definition repository and source reader prove
 * the full chain official source -> applicability decision -> rule definitions
 * -> M8.3C resolver -> M8.3B cost stack.
 */

const ORG = "org-1";
const SOURCE = "source-cp-l-01-07";
const OTHER_SOURCE = "source-other";
const DECISION = "decision-cp-l-01-07";

type SeededDecision = ApplicabilityDecisionForRule & { organizationId: string };

class MemoryRuleDefinitionRepository
  implements ProfessionalRuleDefinitionRepository
{
  definitions: ProfessionalRuleDefinitionRecord[] = [];
  decisions: SeededDecision[] = [];
  createCalls = 0;

  async ensureCompanyCalculationRuleSource() {
    return {
      id: "source-company",
      code: "DEVIZO-COMPANY-CALC-RULES",
      edition: "1",
      sourceType: "company_custom",
    };
  }

  async createRuleDefinition(
    input: CreateProfessionalRuleDefinitionInput,
  ): Promise<ProfessionalRuleDefinitionRecord> {
    this.createCalls += 1;
    const now = new Date("2026-10-13T00:00:00Z");
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

type SeededSource = {
  id: string;
  organizationId: string;
  code: string;
  edition: string;
};

class MemorySourceReader implements NormativeSourceReader {
  sources: SeededSource[] = [];

  async getSource(
    organizationId: string,
    sourceId: string,
  ): Promise<SeededSource | null> {
    return (
      this.sources.find(
        (s) => s.organizationId === organizationId && s.id === sourceId,
      ) ?? null
    );
  }
}

function cpSource(overrides: Partial<SeededSource> = {}): SeededSource {
  return {
    id: SOURCE,
    organizationId: ORG,
    code: CP_L_01_07_2012_SOURCE_CODE,
    edition: CP_L_01_07_2012_SOURCE_EDITION,
    ...overrides,
  };
}

function applicableDecision(
  overrides: Partial<SeededDecision> = {},
): SeededDecision {
  return {
    id: DECISION,
    organizationId: ORG,
    sourceId: SOURCE,
    decision: "applicable",
    applicableFrom: "2012-08-17",
    applicableUntil: null,
    ...overrides,
  };
}

function seededReady(): {
  reader: MemorySourceReader;
  repo: MemoryRuleDefinitionRepository;
  service: ProfessionalRuleDefinitionService;
  installer: CpL010720112RulePackInstaller;
} {
  const reader = new MemorySourceReader();
  reader.sources.push(cpSource());
  const repo = new MemoryRuleDefinitionRepository();
  repo.decisions.push(applicableDecision());
  const service = new ProfessionalRuleDefinitionService(repo);
  const installer = new CpL010720112RulePackInstaller(reader, service);
  return { reader, repo, service, installer };
}

async function expectPackError(
  code: string,
  run: () => Promise<unknown>,
): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(
      error instanceof OfficialRulePackError,
      `expected OfficialRulePackError, got ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });
}

/** Builds a deterministic M8.3A material-only calculation with a given cost. */
function vatExclusiveMaterialResourceCalculation(materialCost: string) {
  return calculateResources([
    {
      estimateNormVersionId: "nv-1",
      resourceConsumptionId: "rc-1",
      resourceId: "res-material",
      resourcePriceId: "rp-1",
      normApplicationId: null,
      resourceType: "material",
      currency: "MDL",
      workQuantity: materialCost,
      normBasisQuantity: "1",
      normativeConsumption: "1",
      applicationCoefficient: "1",
      resourcePrice: "1",
      priceBasisQuantity: "1",
    },
  ]);
}

function notApplicable(reason: string) {
  return { status: "not_applicable" as const, reason };
}

async function main(): Promise<void> {
  // 1. Valid source + applicable decision installs both definitions.
  // 2. candidateId is the persisted definition id.
  // 3. provenance survives mapping.
  // 13. no calculation_rules row is created (calculationRuleId null).
  // 14. decimal values remain strings.
  {
    const { repo, installer } = seededReady();
    const result = await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    assert.equal(result.definitions.length, 2);
    assert.equal(repo.createCalls, 2);
    assert.ok(result.definitions.every((d) => d.reused === false));

    const construction = result.definitions.find(
      (d) =>
        d.procurementCategory ===
        CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
    );
    const metal = result.definitions.find(
      (d) => d.procurementCategory === CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
    );
    assert.ok(construction && metal);
    assert.equal(construction.definition.value, "2");
    assert.equal(metal.definition.value, "0.75");

    for (const installed of result.definitions) {
      const def = installed.definition;
      assert.equal(def.sourceId, SOURCE);
      assert.equal(def.applicabilityDecisionId, DECISION);
      assert.equal(def.ruleOrigin, "normative_sector_average");
      assert.equal(def.component, "procurement_storage");
      assert.equal(def.estimatePerspective, "investor");
      assert.equal(def.calculationBasis, "material_cost");
      assert.equal(def.currency, null);
      assert.equal(typeof def.value, "string");
      assert.ok(def.sourceReference?.startsWith("CP L.01.07-2012"));
    }
  }

  // 4, 5. construction_materials resolves to 2%, metal_structures to 0.75%.
  // 6. equipment category returns missing.
  // 7. contractor context does not select investor definitions.
  // 8. unknown category returns missing.
  {
    const { service, installer } = seededReady();
    const installed = await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    const candidates = await service.loadCandidatesForComponent(
      ORG,
      "procurement_storage",
    );
    assert.equal(candidates.length, 2);
    for (const candidate of candidates) {
      assert.equal(candidate.calculationRuleId, null);
      assert.equal(candidate.sourceId, SOURCE);
      assert.equal(candidate.applicabilityDecisionId, DECISION);
      const persisted = installed.definitions.find(
        (entry) => entry.definition.id === candidate.candidateId,
      );
      assert.ok(persisted, "candidateId must be the persisted definition id");
      assert.equal(candidate.sourceReference, persisted.definition.sourceReference);
      assert.equal(
        candidate.applicabilityDecisionId,
        persisted.definition.applicabilityDecisionId,
      );
    }

    const base: ProfessionalRuleResolutionContext = {
      valuationDate: "2026-06-15",
      estimatePerspective: "investor",
      workKind: "construction",
      currency: "MDL",
    };

    const construction = resolveProfessionalRule(
      "procurement_storage",
      candidates,
      {
        ...base,
        procurementStorageCategory:
          CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      },
    );
    assert.equal(construction.status, "selected");
    assert.equal(construction.candidate?.value, "2");

    const metal = resolveProfessionalRule("procurement_storage", candidates, {
      ...base,
      procurementStorageCategory: CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
    });
    assert.equal(metal.status, "selected");
    assert.equal(metal.candidate?.value, "0.75");

    // 6. equipment: not persisted yet, no invented 1.2% support.
    const equipment = resolveProfessionalRule(
      "procurement_storage",
      candidates,
      { ...base, procurementStorageCategory: "equipment" },
    );
    assert.equal(equipment.status, "missing");

    // 8. unknown category.
    const unknown = resolveProfessionalRule(
      "procurement_storage",
      candidates,
      { ...base, procurementStorageCategory: "totally_unknown" },
    );
    assert.equal(unknown.status, "missing");

    // 7. contractor perspective must not pick these investor rules.
    const contractor = resolveProfessionalRule(
      "procurement_storage",
      candidates,
      {
        ...base,
        estimatePerspective: "contractor",
        procurementStorageCategory:
          CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      },
    );
    assert.equal(contractor.status, "missing");
  }

  // 9. wrong source code is rejected.
  {
    const reader = new MemorySourceReader();
    reader.sources.push(cpSource({ code: "CP L.01.03-2012" }));
    const repo = new MemoryRuleDefinitionRepository();
    repo.decisions.push(applicableDecision());
    const installer = new CpL010720112RulePackInstaller(
      reader,
      new ProfessionalRuleDefinitionService(repo),
    );
    await expectPackError("source_code_mismatch", () =>
      installer.install({
        organizationId: ORG,
        sourceId: SOURCE,
        applicabilityDecisionId: DECISION,
      }),
    );
    assert.equal(repo.createCalls, 0);
  }

  // 10. wrong edition is rejected.
  {
    const reader = new MemorySourceReader();
    reader.sources.push(cpSource({ edition: "2020" }));
    const repo = new MemoryRuleDefinitionRepository();
    repo.decisions.push(applicableDecision());
    const installer = new CpL010720112RulePackInstaller(
      reader,
      new ProfessionalRuleDefinitionService(repo),
    );
    await expectPackError("source_edition_mismatch", () =>
      installer.install({
        organizationId: ORG,
        sourceId: SOURCE,
        applicabilityDecisionId: DECISION,
      }),
    );
    assert.equal(repo.createCalls, 0);
  }

  // Missing source is rejected (identity gate).
  {
    const reader = new MemorySourceReader();
    const repo = new MemoryRuleDefinitionRepository();
    const installer = new CpL010720112RulePackInstaller(
      reader,
      new ProfessionalRuleDefinitionService(repo),
    );
    await expectPackError("source_not_found", () =>
      installer.install({
        organizationId: ORG,
        sourceId: "missing",
        applicabilityDecisionId: DECISION,
      }),
    );
  }

  // Rules are never attached to a different source that happens to have a
  // valid applicable decision.
  {
    const reader = new MemorySourceReader();
    reader.sources.push(cpSource({ id: OTHER_SOURCE, code: "CP L.01.03-2012" }));
    const repo = new MemoryRuleDefinitionRepository();
    repo.decisions.push(
      applicableDecision({ id: "other-decision", sourceId: OTHER_SOURCE }),
    );
    const installer = new CpL010720112RulePackInstaller(
      reader,
      new ProfessionalRuleDefinitionService(repo),
    );
    await expectPackError("source_code_mismatch", () =>
      installer.install({
        organizationId: ORG,
        sourceId: OTHER_SOURCE,
        applicabilityDecisionId: "other-decision",
      }),
    );
  }

  // 11. installing the same pack twice is idempotent (no duplicates).
  {
    const { repo, installer } = seededReady();
    const first = await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    assert.ok(first.definitions.every((d) => d.reused === false));
    assert.equal(repo.createCalls, 2);

    const second = await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    assert.ok(second.definitions.every((d) => d.reused === true));
    assert.equal(repo.createCalls, 2); // no new rows
    assert.equal(repo.definitions.length, 2);
    // Reused definitions are the exact same persisted rows.
    assert.deepEqual(
      second.definitions.map((d) => d.definition.id).sort(),
      first.definitions.map((d) => d.definition.id).sort(),
    );
  }

  // The install call uses the exact caller-selected applicability decision,
  // regardless of another (later) applicable decision for the same source.
  {
    const { repo, installer } = seededReady();
    repo.decisions.push(
      applicableDecision({
        id: "later-applicability-decision",
        applicableFrom: "2020-01-01",
      }),
    );
    const installed = await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    assert.ok(
      installed.definitions.every(
        (entry) => entry.definition.applicabilityDecisionId === DECISION,
      ),
    );
  }

  // NUMERIC(18,6) values returned by PostgreSQL may have fixed scale; compare
  // them numerically rather than treating equivalent decimal strings as conflicts.
  {
    const { repo, installer } = seededReady();
    await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    const construction = repo.definitions.find(
      (definition) =>
        definition.procurementCategory ===
        CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
    );
    const metal = repo.definitions.find(
      (definition) =>
        definition.procurementCategory ===
        CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
    );
    assert.ok(construction && metal);
    construction.value = "2.000000";
    metal.value = "0.750000";

    const reused = await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    assert.equal(repo.createCalls, 2);
    assert.equal(repo.definitions.length, 2);
    assert.ok(reused.definitions.every((entry) => entry.reused));
    assert.deepEqual(
      reused.definitions.map((entry) => entry.definition.id).sort(),
      [construction.id, metal.id].sort(),
    );
  }

  // More than one persisted row in a single pack slot is an integrity failure,
  // even when both definitions are otherwise identical.
  {
    const { repo, installer } = seededReady();
    await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    const construction = repo.definitions.find(
      (definition) =>
        definition.procurementCategory ===
        CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
    );
    assert.ok(construction);
    repo.definitions.push({
      ...construction,
      id: "duplicate-construction-definition",
    });

    const countBeforeRetry = repo.definitions.length;
    const createCallsBeforeRetry = repo.createCalls;
    await expectPackError("duplicate_existing_definition", () =>
      installer.install({
        organizationId: ORG,
        sourceId: SOURCE,
        applicabilityDecisionId: DECISION,
      }),
    );
    assert.equal(repo.createCalls, createCallsBeforeRetry);
    assert.equal(repo.definitions.length, countBeforeRetry);
  }

  // 12. Preflight detects a metal conflict before creating the missing
  // construction-materials definition; no partial installation is allowed.
  {
    const { repo, installer } = seededReady();
    // Pre-seed a metal_structures investor rule with a different rate.
    const now = new Date("2026-10-13T00:00:00Z");
    repo.definitions.push({
      id: "pre-existing",
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
      name: "Tampered metal structures rate",
      component: "procurement_storage",
      valueType: "percent",
      value: "1", // conflicts with normative 0.75%
      currency: null,
      calculationBasis: "material_cost",
      validFrom: "2012-08-17",
      validTo: null,
      estimatePerspective: "investor",
      workKind: "any",
      ruleOrigin: "normative_sector_average",
      procurementCategory: CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
      sourceReference: "CP L.01.07-2012, pct. 3.2, 3.3(c)",
      notes: null,
      createdAt: now,
      updatedAt: now,
    });
    await expectPackError("conflicting_existing_definition", () =>
      installer.install({
        organizationId: ORG,
        sourceId: SOURCE,
        applicabilityDecisionId: DECISION,
      }),
    );
    assert.equal(repo.createCalls, 0);
    assert.equal(repo.definitions.length, 1);
    assert.equal(
      repo.definitions.some(
        (definition) =>
          definition.procurementCategory ===
          CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      ),
      false,
      "the missing construction_materials rule must not be partially created",
    );
    // The conflicting row is never mutated to the normative rate.
    const preExisting = repo.definitions.find((d) => d.id === "pre-existing");
    assert.equal(preExisting?.value, "1");
  }

  // Exact rows are not trusted for reuse unless their exact linked decision
  // still passes the M8.3D governance gate.
  {
    const { repo, installer } = seededReady();
    await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    repo.decisions[0]!.decision = "not_applicable";
    const rowsBeforeRetry = repo.definitions.length;
    const createCallsBeforeRetry = repo.createCalls;
    await assert.rejects(
      installer.install({
        organizationId: ORG,
        sourceId: SOURCE,
        applicabilityDecisionId: DECISION,
      }),
      (error: unknown) => {
        assert.ok(
          error instanceof ProfessionalRuleDefinitionValidationError,
        );
        assert.equal(error.code, "applicability_not_applicable");
        return true;
      },
    );
    assert.equal(repo.definitions.length, rowsBeforeRetry);
    assert.equal(repo.createCalls, createCallsBeforeRetry);
  }

  // 15a. VAT-exclusive homogeneous material base: construction materials,
  // 100000 MDL.
  {
    const { service, installer } = seededReady();
    await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    const candidates = await service.loadCandidatesForComponent(
      ORG,
      "procurement_storage",
    );

    const resolution = resolveProfessionalRule(
      "procurement_storage",
      candidates,
      {
        valuationDate: "2026-06-15",
        estimatePerspective: "investor",
        workKind: "construction",
        currency: "MDL",
        procurementStorageCategory:
          CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      },
    );
    assert.equal(resolution.status, "selected");
    const selected = resolution.candidate as ProfessionalRuleCandidate;
    assert.equal(selected.value, "2");

    const result = calculateProfessionalCostStack(
      costStackInputFromRule("100000", selected),
    );
    assert.equal(result.materialCost, "100000");
    assert.equal(result.procurementStorage, "2000");
    assert.equal(result.directCost, "102000");
  }

  // 15b. VAT-exclusive homogeneous material base: metal structures, 100000 MDL.
  {
    const { service, installer } = seededReady();
    await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    const candidates = await service.loadCandidatesForComponent(
      ORG,
      "procurement_storage",
    );

    const resolution = resolveProfessionalRule(
      "procurement_storage",
      candidates,
      {
        valuationDate: "2026-06-15",
        estimatePerspective: "investor",
        workKind: "construction",
        currency: "MDL",
        procurementStorageCategory: CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
      },
    );
    assert.equal(resolution.status, "selected");
    const selected = resolution.candidate as ProfessionalRuleCandidate;
    assert.equal(selected.value, "0.75");

    const result = calculateProfessionalCostStack(
      costStackInputFromRule("100000", selected),
    );
    assert.equal(result.materialCost, "100000");
    assert.equal(result.procurementStorage, "750");
    assert.equal(result.directCost, "100750");
  }

  // M8.3F preview uses persisted candidates through governance, M8.3C and M8.3A/B.
  {
    const { service, installer } = seededReady();
    await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });

    const construction = await calculateCpL0107Preview(service, {
      organizationId: ORG,
      sourceId: SOURCE,
      valuationDate: "2026-10-14",
      category: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      materialBase: "100000",
    });
    assert.equal(construction.status, "selected");
    if (construction.status === "selected") {
      assert.equal(construction.valuationDate, "2026-10-14");
      assert.equal(construction.materialBase, "100000");
      assert.equal(
        construction.category,
        CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      );
      assert.equal(construction.ratePercent, "2");
      assert.equal(construction.procurementStorage, "2000");
      assert.equal(construction.directCost, "102000");
      assert.equal(construction.sourceReference, "CP L.01.07-2012, pct. 3.2, 3.3(a)");
    }

    const metal = await calculateCpL0107Preview(service, {
      organizationId: ORG,
      sourceId: SOURCE,
      valuationDate: "2026-10-15",
      category: CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
      materialBase: "100000",
    });
    assert.equal(metal.status, "selected");
    if (metal.status === "selected") {
      assert.equal(metal.valuationDate, "2026-10-15");
      assert.equal(metal.materialBase, "100000");
      assert.equal(metal.category, CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES);
      assert.equal(metal.ratePercent, "0.75");
      assert.equal(metal.procurementStorage, "750");
      assert.equal(metal.directCost, "100750");
    }

    const beforeValidity = await calculateCpL0107Preview(service, {
      organizationId: ORG,
      sourceId: SOURCE,
      valuationDate: "2012-08-16",
      category: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      materialBase: "100000",
    });
    assert.equal(beforeValidity.status, "missing");

    await assert.rejects(
      calculateCpL0107Preview(service, {
        organizationId: ORG,
        sourceId: SOURCE,
        valuationDate: "2026-10-14",
        category: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
        materialBase: "not-a-decimal",
      }),
      CpL0107PreviewValidationError,
    );
    await assert.rejects(
      calculateCpL0107Preview(service, {
        organizationId: ORG,
        sourceId: SOURCE,
        valuationDate: "2026-10-14",
        category: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
        materialBase: "-1",
      }),
      CpL0107PreviewValidationError,
    );
    await assert.rejects(
      calculateCpL0107Preview(service, {
        organizationId: ORG,
        sourceId: SOURCE,
        valuationDate: "2026-10-14",
        category: "equipment",
        materialBase: "100000",
      }),
      CpL0107PreviewValidationError,
    );

    const sourceRules = await service.listRuleDefinitionsForSource(ORG, SOURCE);
    assert.equal(sourceRules.length, 2);
    assert.ok(sourceRules.every((rule) => rule.sourceId === SOURCE));
  }

  // Multiple eligible persisted candidates are surfaced as ambiguous.
  {
    const { service, installer } = seededReady();
    await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    await service.createRuleDefinition({
      organizationId: ORG,
      sourceId: SOURCE,
      name: "Overlapping investor fixture",
      component: "procurement_storage",
      valueType: "percent",
      value: "2",
      currency: null,
      calculationBasis: "material_cost",
      validFrom: "2012-08-17",
      validTo: null,
      estimatePerspective: "investor",
      workKind: "construction",
      ruleOrigin: "company_individual",
      procurementCategory: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      sourceReference: null,
    });
    const result = await calculateCpL0107Preview(service, {
      organizationId: ORG,
      sourceId: SOURCE,
      valuationDate: "2026-10-14",
      category: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      materialBase: "100000",
    });
    assert.equal(result.status, "ambiguous");
    if (result.status === "ambiguous") {
      assert.equal(result.candidateIds.length, 2);
    }
  }

  // An eligible contractor definition cannot override the preview's explicit investor perspective.
  {
    const { service, installer } = seededReady();
    await installer.install({
      organizationId: ORG,
      sourceId: SOURCE,
      applicabilityDecisionId: DECISION,
    });
    await service.createRuleDefinition({
      organizationId: ORG,
      sourceId: SOURCE,
      name: "Contractor material fixture",
      component: "procurement_storage",
      valueType: "percent",
      value: "3",
      currency: null,
      calculationBasis: "material_cost",
      validFrom: "2012-08-17",
      validTo: null,
      estimatePerspective: "contractor",
      workKind: "construction",
      ruleOrigin: "company_individual",
      procurementCategory: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      sourceReference: null,
    });
    const result = await calculateCpL0107Preview(service, {
      organizationId: ORG,
      sourceId: SOURCE,
      valuationDate: "2026-10-14",
      category: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
      materialBase: "100000",
    });
    assert.equal(result.status, "selected");
    if (result.status === "selected") {
      assert.equal(result.ratePercent, "2");
    }
  }

  // Pack data sanity: exactly the two investor sector-average rules, no
  // contractor rules and no equipment rate.
  {
    assert.equal(CP_L_01_07_2012_RULE_PACK.length, 2);
    assert.ok(
      CP_L_01_07_2012_RULE_PACK.every(
        (r) =>
          r.estimatePerspective === "investor" &&
          r.ruleOrigin === "normative_sector_average",
      ),
    );
    assert.ok(
      !CP_L_01_07_2012_RULE_PACK.some((r) => r.procurementCategory === "equipment"),
    );
  }

  console.log("CP L.01.07-2012 official rule pack checks passed.");
}

function costStackInputFromRule(
  materialCost: string,
  selected: ProfessionalRuleCandidate,
): ProfessionalCostStackInput {
  return {
    // This M8.3E fixture assumes the resource price is known to be VAT-exclusive.
    resourceCalculation: vatExclusiveMaterialResourceCalculation(materialCost),
    laborContributions: notApplicable("No labor in this homogeneous scenario."),
    materialTransport: notApplicable("Transport excluded from the base here."),
    procurementStorage: {
      status: "applied",
      ratePercent: selected.value,
      rule: {
        ruleType: selected.ruleOrigin,
        calculationRuleId: null,
        sourceId: selected.sourceId ?? null,
        sourceReference: selected.sourceReference ?? null,
      },
    },
    overhead: notApplicable("Overhead is out of M8.3E scope."),
    estimatedProfit: notApplicable("Estimated profit is out of M8.3E scope."),
  };
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
