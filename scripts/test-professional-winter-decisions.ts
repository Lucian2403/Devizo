import assert from "node:assert/strict";
import {
  calculateProfessionalGeneralEstimate,
  applyTemporaryWorksToGeneralEstimate,
  calculateTemporaryWorks,
  calculateTemporaryWorksBase,
} from "../domain/professional-estimates/calculation";
import {
  ProfessionalWinterConditionsError,
  ProfessionalWinterConditionsService,
  validateShortProject,
} from "../domain/professional-estimates/professional-winter-conditions.service";
import type {
  PersistedWinterDecisionInput,
  ProfessionalWinterDecisionsRepository,
  WinterDecisionRecord,
} from "../domain/professional-estimates/professional-winter-decisions.repository";
import type { ProfessionalWinterRulesService } from "../domain/professional-estimates/professional-winter-rules.service";
import type { WinterRulesSetup } from "../domain/professional-estimates/professional-winter-rules.service";
import type { TemporaryWorksView } from "../domain/professional-estimates/professional-temporary-works.service";
import type { WinterRuleDefinitionRecord } from "../domain/professional-estimates/professional-winter-rules.repository";
import {
  NCM_L_02_06_2012_RULE_PACK,
} from "../domain/professional-estimates/official-rule-packs/ncm-l-02-06-2012";

const ids = {
  org: "10000000-0000-4000-8000-000000000001",
  foreign: "10000000-0000-4000-8000-000000000002",
  estimate: "20000000-0000-4000-8000-000000000001",
  rule: "30000000-0000-4000-8000-000000000001",
};

function persistedRule(code: string): WinterRuleDefinitionRecord {
  const official = NCM_L_02_06_2012_RULE_PACK.find((row) => row.ruleCode === code);
  assert.ok(official);
  return {
    id: ids.rule,
    organizationId: ids.org,
    sourceId: "40000000-0000-4000-8000-000000000001",
    applicabilityDecisionId: "50000000-0000-4000-8000-000000000001",
    component: "winter_conditions",
    ruleCode: official.ruleCode,
    groupCode: official.groupCode,
    groupLabel: official.groupLabel,
    name: official.name,
    valueType: "percent",
    value: official.ratePercent,
    validFrom: "2013-02-15",
    validTo: null,
    sourceReference: official.sourceReference,
    createdAt: new Date("2026-10-26T00:00:00Z"),
    updatedAt: new Date("2026-10-26T00:00:00Z"),
  };
}

class MemoryRepository implements ProfessionalWinterDecisionsRepository {
  decision: WinterDecisionRecord | null = null;
  async getGeneralEstimate(org: string, id: string) {
    return org === ids.org && id === ids.estimate
      ? { id, organizationId: org, valuationDate: "2026-10-15", currency: "MDL" }
      : null;
  }
  async getDecision(org: string, id: string) {
    return this.decision?.organizationId === org &&
      this.decision.generalEstimateId === id ? { ...this.decision } : null;
  }
  async saveDecision(org: string, id: string, input: PersistedWinterDecisionInput) {
    const decision: WinterDecisionRecord = {
      ...input,
      id: this.decision?.id ?? "60000000-0000-4000-8000-000000000001",
      organizationId: org, generalEstimateId: id,
      updatedAt: new Date("2026-10-26T00:00:00Z"),
    };
    this.decision = decision;
    return { ...decision };
  }
}

const original = calculateProfessionalGeneralEstimate([
  {
    objectEstimateId: "70000000-0000-4000-8000-000000000001", chapterNumber: 2,
    constructionWorks: "5051.2539", installationWorks: "0",
    equipmentFurnitureInventory: "0", otherCosts: "0", currency: "MDL",
  },
  {
    objectEstimateId: "70000000-0000-4000-8000-000000000002", chapterNumber: 9,
    constructionWorks: "200", installationWorks: "0",
    equipmentFurnitureInventory: "100", otherCosts: "20", currency: "MDL",
  },
]);
const base = calculateTemporaryWorksBase(original);
const temporaryResult = calculateTemporaryWorks({
  baseConstruction: base.construction, baseInstallation: base.installation,
  ratePercent: "0.8", projectCondition: "standard",
});
const afterTemp = applyTemporaryWorksToGeneralEstimate(original, temporaryResult);
const temporary = {
  adjustedGeneralCalculationComplete: true,
  adjustedTotals: afterTemp,
} as TemporaryWorksView;
const estimate = {
  id: ids.estimate, valuationDate: "2026-10-15",
  currency: "MDL", complete: true, totals: original,
};

const rules = { eligibleRules: [persistedRule("024")], installedRules: [persistedRule("024")] } as WinterRulesSetup;
const fakeRules = {
  async getSetup() { return rules; },
} as unknown as ProfessionalWinterRulesService;

async function main() {
  const repo = new MemoryRepository();
  const service = new ProfessionalWinterConditionsService(repo, fakeRules);

  assert.equal((await service.getView(ids.org, estimate, temporary)).complete, false);
  await assert.rejects(
    service.saveDecision(ids.foreign, ids.estimate, {
      mode: "not_applicable", exclusionReason: "heated_current_repair",
    }),
    ProfessionalWinterConditionsError,
  );

  const annual = {
    mode: "normative_rate" as const,
    ruleDefinitionId: ids.rule,
    buildingScope: "other" as const,
    principalWorkConfirmed: false,
    classification: "listed" as const,
    analogyReference: null,
    period: { kind: "annual_average" as const },
  };
  await service.saveDecision(ids.org, ids.estimate, annual);
  const annualView = await service.getView(ids.org, estimate, temporary);
  assert.equal(annualView.result?.winterTotal, "40.7333114496");
  assert.equal(annualView.adjustedTotals?.chapters[8].total, "40.4100312");
  assert.equal(annualView.adjustedTotals?.chapters[9].constructionWorks, "240.7333114496");
  assert.equal(annualView.adjustedTotals?.totals.total, "5452.3972426496");
  assert.equal(annualView.complete, true);
  assert.equal(repo.decision?.periodKind, "annual_average");

  assert.deepEqual(
    validateShortProject("2026-10-01", "2027-01-08", "23", "Grafic POS"),
    { durationDays: "100", winterDays: "23", projectReference: "Grafic POS" },
  );
  for (const [start, end, days, ref] of [
    ["2026-02-30", "2026-04-01", "2", "POS"],
    ["2026-01-01", "2027-01-01", "20", "POS"],
    ["2026-01-01", "2026-12-31", "20", "POS"],
    ["2024-02-29", "2025-02-28", "20", "POS"],
    ["2026-10-01", "2026-10-10", "11", "POS"],
    ["2026-10-01", "2026-10-10", "-1", "POS"],
    ["2026-10-01", "2026-10-10", "1.5", "POS"],
    ["2026-10-01", "2026-10-10", "1", " "],
  ] as const) {
    assert.throws(() => validateShortProject(start, end, days, ref),
      ProfessionalWinterConditionsError);
  }

  await service.saveDecision(ids.org, ids.estimate, {
    ...annual, period: {
      kind: "short_project", startDate: "2026-10-01",
      endDate: "2027-01-08", winterDays: "46", projectReference: "POS, grafic 1",
    },
  });
  const short = await service.getView(ids.org, estimate, temporary);
  assert.equal(short.result?.coefficient, "2");
  assert.equal(short.result?.winterTotal, "81.4666228992");
  assert.equal(short.adjustedTotals?.chapters[9].constructionWorks, "281.4666228992");

  await assert.rejects(
    service.saveDecision(ids.org, ids.estimate, {
      ...annual, buildingScope: "residential_administrative",
    }),
    (error: unknown) => error instanceof ProfessionalWinterConditionsError &&
      error.code === "incorrect_residential_rule",
  );
  await assert.rejects(
    service.saveDecision(ids.org, ids.estimate, {
      ...annual, classification: "analogous", analogyReference: "",
    }),
    ProfessionalWinterConditionsError,
  );
  await service.saveDecision(ids.org, ids.estimate, {
    ...annual, classification: "analogous", analogyReference: "Proiect, argument analogic",
  });
  assert.equal(repo.decision?.analogyReference, "Proiect, argument analogic");

  rules.eligibleRules = [persistedRule("013")];
  rules.installedRules = rules.eligibleRules;
  await assert.rejects(
    service.saveDecision(ids.org, ids.estimate, { ...annual, principalWorkConfirmed: false }),
    ProfessionalWinterConditionsError,
  );
  await service.saveDecision(ids.org, ids.estimate, {
    ...annual, principalWorkConfirmed: true,
  });
  assert.equal((await service.getView(ids.org, estimate, temporary)).complete, true);

  rules.eligibleRules = [];
  const stale = await service.getView(ids.org, estimate, temporary);
  assert.equal(stale.complete, false);
  assert.equal(stale.adjustedTotals, null);
  assert.match(stale.error ?? "", /nu mai este eligibilă/);

  rules.eligibleRules = [persistedRule("013")];
  rules.eligibleRules[0]!.value = "9.9";
  const modified = await service.getView(ids.org, estimate, temporary);
  assert.equal(modified.complete, false);
  assert.equal(modified.adjustedTotals, null);
  assert.match(modified.error ?? "", /nu coincide/);

  await service.saveDecision(ids.org, ids.estimate, {
    mode: "not_applicable", exclusionReason: "heated_current_repair",
  });
  const skipped = await service.getView(ids.org, estimate, temporary);
  assert.equal(skipped.complete, true);
  assert.equal(skipped.result, null);
  assert.equal(skipped.adjustedTotals?.totals.total, afterTemp.totals.total);
  assert.equal(repo.decision?.ruleDefinitionId, null);

  const incomplete = await service.getView(ids.org, estimate, {
    ...temporary, adjustedGeneralCalculationComplete: false, adjustedTotals: null,
  });
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.adjustedTotals, null);

  console.log("M8.5C2B2 winter decision, provenance, schedule and Chapter 9 regression: OK");
}
void main();
