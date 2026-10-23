import assert from "node:assert/strict";
import {
  applyTemporaryWorksToGeneralEstimate,
  calculateProfessionalGeneralEstimate,
  calculateProjectTemporaryWorks,
  calculateTemporaryWorks,
  calculateTemporaryWorksBase,
  temporaryWorksCoefficient,
} from "../domain/professional-estimates/calculation";
import {
  NCM_L_02_05_2012_RULE_PACK,
} from "../domain/professional-estimates/official-rule-packs/ncm-l-02-05-2012";
import {
  ProfessionalTemporaryWorksError,
  ProfessionalTemporaryWorksService,
} from "../domain/professional-estimates/professional-temporary-works.service";
import type {
  CreateProfessionalGeneralRuleDefinitionInput,
  ProfessionalGeneralCostDecisionRecord,
  ProfessionalGeneralRuleDefinitionRecord,
  ProfessionalTemporaryWorksRepository,
  SaveProfessionalGeneralCostDecisionInput,
  TemporaryWorksApplicabilityDecision,
  TemporaryWorksNormativeSource,
} from "../domain/professional-estimates/professional-temporary-works.repository";

const ids = {
  org: "10000000-0000-4000-8000-000000000001",
  source: "20000000-0000-4000-8000-000000000001",
  applicability: "30000000-0000-4000-8000-000000000001",
  general: "40000000-0000-4000-8000-000000000001",
};

const source: TemporaryWorksNormativeSource = {
  id: ids.source,
  organizationId: ids.org,
  code: "NCM L.02.05-2012",
  title:
    "Economia construcțiilor. Norme de deviz pentru construirea clădirilor și construcțiilor speciale provizorii",
  edition: "2012",
  sourceType: "normative_document",
  jurisdiction: "MD",
  status: "active",
  officialStatus: "in_force",
  effectiveDate: "2013-02-15",
  validFrom: "2013-02-15",
  validTo: null,
  sourceUri: "https://ednc.gov.md/ncm-l-02-05-2012/",
};

const applicability: TemporaryWorksApplicabilityDecision = {
  id: ids.applicability,
  organizationId: ids.org,
  sourceId: ids.source,
  revision: 1,
  decision: "applicable",
  applicableFrom: "2013-02-15",
  applicableUntil: null,
  officialStatus: "in_force",
  sourceCode: "NCM L.02.05-2012",
  sourceEdition: "2012",
  basisNote: "Fixture",
};

function generalTotals() {
  return calculateProfessionalGeneralEstimate([
    {
      objectEstimateId: "50000000-0000-4000-8000-000000000001",
      chapterNumber: 2,
      constructionWorks: "5051.2539",
      installationWorks: "0",
      equipmentFurnitureInventory: "0",
      otherCosts: "0",
      currency: "MDL",
    },
  ]);
}

function testPureCalculation() {
  assert.equal(NCM_L_02_05_2012_RULE_PACK.length, 47);
  assert.equal(
    new Set(NCM_L_02_05_2012_RULE_PACK.map((rule) => rule.ruleCode)).size,
    47,
  );
  const row25 = NCM_L_02_05_2012_RULE_PACK.find(
    (rule) => rule.ruleCode === "025",
  );
  assert.ok(row25);
  assert.equal(row25.ratePercent, "0.8");
  assert.equal(
    NCM_L_02_05_2012_RULE_PACK.find((rule) => rule.ruleCode === "020A")
      ?.ratePercent,
    "1.8",
  );
  assert.equal(
    NCM_L_02_05_2012_RULE_PACK.find((rule) => rule.ruleCode === "020B")
      ?.ratePercent,
    "3.0",
  );
  assert.equal(temporaryWorksCoefficient("standard"), "1");
  assert.equal(
    temporaryWorksCoefficient("reconstruction_or_extension_operating_facility"),
    "0.8",
  );
  assert.equal(temporaryWorksCoefficient("road_reconstruction"), "0.8");
  assert.equal(temporaryWorksCoefficient("capital_repair_complex"), "1");
  assert.equal(temporaryWorksCoefficient("capital_repair_selective"), "0.5");

  const standard = calculateTemporaryWorks({
    baseConstruction: "5051.2539",
    baseInstallation: "0",
    ratePercent: "0.8",
    projectCondition: "standard",
  });
  assert.equal(standard.temporaryConstruction, "40.4100312");
  assert.equal(standard.temporaryInstallation, "0");
  assert.equal(standard.temporaryTotal, "40.4100312");
  assert.equal(standard.recoverableAmount, "6.06150468");

  const reconstruction = calculateTemporaryWorks({
    baseConstruction: "5051.2539",
    baseInstallation: "0",
    ratePercent: "0.8",
    projectCondition: "reconstruction_or_extension_operating_facility",
  });
  assert.equal(reconstruction.temporaryTotal, "32.32802496");

  const selective = calculateTemporaryWorks({
    baseConstruction: "5051.2539",
    baseInstallation: "0",
    ratePercent: "0.8",
    projectCondition: "capital_repair_selective",
  });
  assert.equal(selective.temporaryTotal, "20.2050156");

  const split = calculateTemporaryWorks({
    baseConstruction: "1000",
    baseInstallation: "250",
    ratePercent: "2",
    projectCondition: "standard",
  });
  assert.equal(split.temporaryConstruction, "20");
  assert.equal(split.temporaryInstallation, "5");
  assert.equal(split.temporaryTotal, "25");

  const project = calculateProjectTemporaryWorks({
    baseConstruction: "5051.2539",
    baseInstallation: "0",
    projectConstructionAmount: "100",
    projectInstallationAmount: "25",
  });
  assert.equal(project.ratePercent, null);
  assert.equal(project.coefficient, null);
  assert.equal(project.temporaryTotal, "125");

  const baseTotals = calculateProfessionalGeneralEstimate([
    {
      objectEstimateId: "60000000-0000-4000-8000-000000000001",
      chapterNumber: 2,
      constructionWorks: "5051.2539",
      installationWorks: "0",
      equipmentFurnitureInventory: "0",
      otherCosts: "0",
      currency: "MDL",
    },
    {
      objectEstimateId: "60000000-0000-4000-8000-000000000002",
      chapterNumber: 8,
      constructionWorks: "100",
      installationWorks: "25",
      equipmentFurnitureInventory: "0",
      otherCosts: "0",
      currency: "MDL",
    },
    {
      objectEstimateId: "60000000-0000-4000-8000-000000000003",
      chapterNumber: 9,
      constructionWorks: "200",
      installationWorks: "50",
      equipmentFurnitureInventory: "0",
      otherCosts: "0",
      currency: "MDL",
    },
  ]);
  const base = calculateTemporaryWorksBase(baseTotals);
  assert.deepEqual(base, {
    construction: "5051.2539",
    installation: "0",
    combined: "5051.2539",
  });

  const adjusted = applyTemporaryWorksToGeneralEstimate(
    generalTotals(),
    standard,
  );
  assert.equal(adjusted.chapters[2].total, "5051.2539");
  assert.equal(adjusted.chapters[8].constructionWorks, "40.4100312");
  assert.equal(adjusted.chapters[8].installationWorks, "0");
  assert.equal(adjusted.totals.total, "5091.6639312");
  assert.equal(
    adjusted.totals.total,
    "5091.6639312",
    "recoverable 15% is reported separately and does not reduce the subtotal",
  );

  assert.throws(
    () =>
      calculateProjectTemporaryWorks({
        baseConstruction: "1",
        baseInstallation: "0",
        projectConstructionAmount: "0",
        projectInstallationAmount: "0",
      }),
    /positive construction or installation/,
  );
}

class MemoryRepository implements ProfessionalTemporaryWorksRepository {
  source: TemporaryWorksNormativeSource | null = { ...source };
  decisions: TemporaryWorksApplicabilityDecision[] = [{ ...applicability }];
  rules: ProfessionalGeneralRuleDefinitionRecord[] = [];
  costDecision: ProfessionalGeneralCostDecisionRecord | null = null;
  ruleCounter = 0;

  async findSourceByIdentity(org: string, code: string, edition: string) {
    return this.source &&
      this.source.organizationId === org &&
      this.source.code === code &&
      this.source.edition === edition
      ? this.source
      : null;
  }

  async getSource(org: string, sourceId: string) {
    return this.source &&
      this.source.organizationId === org &&
      this.source.id === sourceId
      ? this.source
      : null;
  }

  async listApplicabilityDecisions(org: string, sourceId: string) {
    return this.decisions.filter(
      (row) => row.organizationId === org && row.sourceId === sourceId,
    );
  }

  async getApplicabilityDecision(
    org: string,
    sourceId: string,
    decisionId: string,
  ) {
    return (
      this.decisions.find(
        (row) =>
          row.organizationId === org &&
          row.sourceId === sourceId &&
          row.id === decisionId,
      ) ?? null
    );
  }

  async listRuleDefinitions(org: string, sourceId: string) {
    return this.rules.filter(
      (row) => row.organizationId === org && row.sourceId === sourceId,
    );
  }

  async createRuleDefinitions(
    rows: readonly CreateProfessionalGeneralRuleDefinitionInput[],
  ) {
    const created = rows.map((row) => {
      this.ruleCounter += 1;
      const now = new Date("2026-10-23T00:00:00Z");
      return {
        ...row,
        id: `70000000-0000-4000-8000-${String(this.ruleCounter).padStart(12, "0")}`,
        createdAt: now,
        updatedAt: now,
      };
    });
    this.rules.push(...created);
    return created;
  }

  async getRuleDefinition(org: string, id: string) {
    return (
      this.rules.find(
        (row) => row.organizationId === org && row.id === id,
      ) ?? null
    );
  }

  async getGeneralEstimate(org: string, id: string) {
    if (org !== ids.org || id !== ids.general) return null;
    return {
      id,
      organizationId: org,
      valuationDate: "2026-10-15",
      currency: "MDL",
    };
  }

  async getDecision(org: string, generalId: string) {
    if (
      !this.costDecision ||
      this.costDecision.organizationId !== org ||
      this.costDecision.generalEstimateId !== generalId
    ) {
      return null;
    }
    return this.costDecision;
  }

  async saveDecision(
    org: string,
    generalId: string,
    input: SaveProfessionalGeneralCostDecisionInput,
  ) {
    const now = new Date("2026-10-23T00:00:00Z");
    const base = {
      id: this.costDecision?.id ?? "80000000-0000-4000-8000-000000000001",
      organizationId: org,
      generalEstimateId: generalId,
      component: "temporary_works" as const,
      createdAt: this.costDecision?.createdAt ?? now,
      updatedAt: now,
    };
    this.costDecision =
      input.mode === "normative_rate"
        ? {
            ...base,
            mode: "normative_rate",
            ruleDefinitionId: input.ruleDefinitionId,
            projectCondition: input.projectCondition,
            projectConstructionAmount: null,
            projectInstallationAmount: null,
            projectReference: null,
          }
        : {
            ...base,
            mode: "project_calculation",
            ruleDefinitionId: null,
            projectCondition: null,
            projectConstructionAmount: input.projectConstructionAmount,
            projectInstallationAmount: input.projectInstallationAmount,
            projectReference: input.projectReference,
          };
    return this.costDecision;
  }
}

async function testService() {
  const repo = new MemoryRepository();
  const service = new ProfessionalTemporaryWorksService(repo);

  const setupBefore = await service.getSetup(ids.org, "2026-10-15");
  assert.equal(setupBefore.expectedRuleCount, 47);
  assert.equal(setupBefore.installedRules.length, 0);

  const firstInstall = await service.installRulePack({
    organizationId: ids.org,
    sourceId: ids.source,
    applicabilityDecisionId: ids.applicability,
  });
  assert.equal(firstInstall.created, 47);
  assert.equal(firstInstall.reused, 0);
  assert.equal(repo.rules.length, 47);

  const secondInstall = await service.installRulePack({
    organizationId: ids.org,
    sourceId: ids.source,
    applicabilityDecisionId: ids.applicability,
  });
  assert.equal(secondInstall.created, 0);
  assert.equal(secondInstall.reused, 47);
  assert.equal(repo.rules.length, 47);

  const rule25 = repo.rules.find((rule) => rule.ruleCode === "025");
  assert.ok(rule25);

  await service.saveDecision(ids.org, ids.general, {
    mode: "normative_rate",
    ruleDefinitionId: rule25.id,
    projectCondition: "standard",
  });

  const view = await service.getView(ids.org, {
    id: ids.general,
    valuationDate: "2026-10-15",
    currency: "MDL",
    complete: true,
    totals: generalTotals(),
  });
  assert.equal(view.base?.combined, "5051.2539");
  assert.equal(view.result?.temporaryTotal, "40.4100312");
  assert.equal(view.result?.recoverableAmount, "6.06150468");
  assert.equal(view.adjustedTotals?.chapters[8].total, "40.4100312");
  assert.equal(view.adjustedTotals?.totals.total, "5091.6639312");

  const decisionId = repo.costDecision?.id;
  await service.saveDecision(ids.org, ids.general, {
    mode: "normative_rate",
    ruleDefinitionId: rule25.id,
    projectCondition: "reconstruction_or_extension_operating_facility",
  });
  assert.equal(repo.costDecision?.id, decisionId);
  const reconstruction = await service.getView(ids.org, {
    id: ids.general,
    valuationDate: "2026-10-15",
    currency: "MDL",
    complete: true,
    totals: generalTotals(),
  });
  assert.equal(reconstruction.result?.temporaryTotal, "32.32802496");
  assert.equal(reconstruction.adjustedTotals?.totals.total, "5083.58192496");

  await service.saveDecision(ids.org, ids.general, {
    mode: "project_calculation",
    projectConstructionAmount: "100",
    projectInstallationAmount: "25",
    projectReference: "POS test / calcul tehnic",
  });
  const project = await service.getView(ids.org, {
    id: ids.general,
    valuationDate: "2026-10-15",
    currency: "MDL",
    complete: true,
    totals: generalTotals(),
  });
  assert.equal(project.result?.temporaryTotal, "125");
  assert.equal(project.adjustedTotals?.totals.total, "5176.2539");

  await assert.rejects(
    service.saveDecision(ids.org, ids.general, {
      mode: "project_calculation",
      projectConstructionAmount: "0",
      projectInstallationAmount: "0",
      projectReference: "POS",
    }),
    ProfessionalTemporaryWorksError,
  );

  await service.saveDecision(ids.org, ids.general, {
    mode: "normative_rate",
    ruleDefinitionId: rule25.id,
    projectCondition: "standard",
  });
  repo.decisions[0]!.decision = "not_applicable";
  const stale = await service.getView(ids.org, {
    id: ids.general,
    valuationDate: "2026-10-15",
    currency: "MDL",
    complete: true,
    totals: generalTotals(),
  });
  assert.equal(stale.temporaryWorksComplete, false);
  assert.equal(stale.adjustedTotals, null);
  assert.match(stale.error ?? "", /nu mai este eligibilă/);
  assert.equal(repo.costDecision?.ruleDefinitionId, rule25.id);

  repo.decisions[0]!.decision = "applicable";
  const baseIncomplete = await service.getView(ids.org, {
    id: ids.general,
    valuationDate: "2026-10-15",
    currency: "MDL",
    complete: false,
    totals: null,
  });
  assert.equal(baseIncomplete.baseAggregationComplete, false);
  assert.equal(baseIncomplete.result, null);

  const sourceStatus = repo.source!.status;
  repo.source!.status = "superseded";
  await assert.rejects(
    service.installRulePack({
      organizationId: ids.org,
      sourceId: ids.source,
      applicabilityDecisionId: ids.applicability,
    }),
    (error: unknown) => {
      assert.ok(error instanceof ProfessionalTemporaryWorksError);
      assert.equal(error.code, "source_identity_mismatch");
      return true;
    },
  );
  repo.source!.status = sourceStatus;
}

testPureCalculation();
testService()
  .then(() => {
    console.log(
      "NCM L.02.05-2012 temporary-works calculation, rule-pack and live decision checks passed.",
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
