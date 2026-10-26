import assert from "node:assert/strict";
import {
  ProfessionalWinterRulesError,
  ProfessionalWinterRulesService,
} from "../domain/professional-estimates/professional-winter-rules.service";
import type {
  CreateWinterRuleDefinitionInput,
  ProfessionalWinterRulesRepository,
  WinterRuleDefinitionRecord,
} from "../domain/professional-estimates/professional-winter-rules.repository";
import type {
  TemporaryWorksApplicabilityDecision,
  TemporaryWorksNormativeSource,
} from "../domain/professional-estimates/professional-temporary-works.repository";
import {
  NCM_L_02_06_2012_RULE_PACK,
} from "../domain/professional-estimates/official-rule-packs/ncm-l-02-06-2012";

const ids = {
  org: "10000000-0000-4000-8000-000000000001",
  otherOrg: "10000000-0000-4000-8000-000000000002",
  source: "20000000-0000-4000-8000-000000000001",
  applicability: "30000000-0000-4000-8000-000000000001",
  revision2: "30000000-0000-4000-8000-000000000002",
};

const source: TemporaryWorksNormativeSource = {
  id: ids.source,
  organizationId: ids.org,
  code: "NCM L.02.06-2012",
  title: "Norme de deviz pentru lucrări pe timp friguros",
  edition: "2012",
  sourceType: "normative_document",
  jurisdiction: "MD",
  status: "active",
  officialStatus: "in_force",
  effectiveDate: "2013-02-15",
  validFrom: "2013-02-15",
  validTo: null,
  sourceUri: "https://ednc.gov.md/ncm-l-02-06-2012/",
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
  sourceCode: source.code,
  sourceEdition: source.edition,
  basisNote: "Test fixture",
};

class MemoryWinterRulesRepository implements ProfessionalWinterRulesRepository {
  source: TemporaryWorksNormativeSource | null = { ...source };
  decisions = [{ ...applicability }];
  rules: WinterRuleDefinitionRecord[] = [];
  ruleCounter = 0;

  async findSourceByIdentity(org: string, code: string, edition: string) {
    return this.source?.organizationId === org &&
      this.source.code === code && this.source.edition === edition
        ? { ...this.source } : null;
  }
  async getSource(org: string, id: string) {
    return this.source?.organizationId === org && this.source.id === id
      ? { ...this.source } : null;
  }
  async listApplicabilityDecisions(org: string, sourceId: string) {
    return this.decisions.filter((r) => r.organizationId === org && r.sourceId === sourceId);
  }
  async getApplicabilityDecision(org: string, sourceId: string, id: string) {
    return this.decisions.find((r) =>
      r.organizationId === org && r.sourceId === sourceId && r.id === id
    ) ?? null;
  }
  async listRuleDefinitions(org: string, sourceId: string) {
    return this.rules.filter((r) =>
      r.organizationId === org && r.sourceId === sourceId &&
      r.component === "winter_conditions"
    );
  }
  async createRuleDefinitions(rows: readonly CreateWinterRuleDefinitionInput[]) {
    const created = rows.map((row): WinterRuleDefinitionRecord => {
      this.ruleCounter += 1;
      return {
        ...row,
        id: "40000000-0000-4000-8000-" + String(this.ruleCounter).padStart(12, "0"),
        createdAt: new Date("2026-10-26T00:00:00Z"),
        updatedAt: new Date("2026-10-26T00:00:00Z"),
      };
    });
    this.rules.push(...created);
    return created;
  }
  async rebindRuleDefinitionsApplicability(
    org: string, sourceId: string, ruleIds: readonly string[], decisionId: string,
  ) {
    const changed: WinterRuleDefinitionRecord[] = [];
    for (const rule of this.rules) {
      if (rule.organizationId === org && rule.sourceId === sourceId &&
        rule.component === "winter_conditions" && ruleIds.includes(rule.id)
      ) {
        rule.applicabilityDecisionId = decisionId;
        changed.push({ ...rule });
      }
    }
    return changed;
  }
}

async function main() {
  assert.equal(NCM_L_02_06_2012_RULE_PACK.length, 58);
  const repo = new MemoryWinterRulesRepository();
  const service = new ProfessionalWinterRulesService(repo);

  const setupBefore = await service.getSetup(ids.org, "2026-10-26");
  assert.equal(setupBefore.expectedRuleCount, 58);
  assert.equal(setupBefore.installedRules.length, 0);
  assert.equal(setupBefore.source?.code, source.code);

  await assert.rejects(
    service.installRulePack({
      organizationId: ids.otherOrg, sourceId: ids.source,
      applicabilityDecisionId: ids.applicability,
    }),
    (err: unknown) => err instanceof ProfessionalWinterRulesError &&
      err.code === "invalid_source",
  );

  const first = await service.installRulePack({
    organizationId: ids.org,
    sourceId: ids.source,
    applicabilityDecisionId: ids.applicability,
  });
  assert.deepEqual(
    [first.expected, first.created, first.reused, first.rebound],
    [58, 58, 0, 0],
  );
  assert.equal(repo.rules.length, 58);
  assert.equal(new Set(repo.rules.map((r) => r.ruleCode)).size, 58);
  assert.equal(repo.rules.find((r) => r.ruleCode === "019B")?.value, "2.4");
  assert.equal(repo.rules.find((r) => r.ruleCode === "020C")?.value, "1.0");
  assert.ok(repo.rules.every((r) => r.component === "winter_conditions"));
  assert.ok(repo.rules.every((r) => r.applicabilityDecisionId === ids.applicability));

  const initialIds = new Map(repo.rules.map((r) => [r.ruleCode, r.id]));
  const repeat = await service.installRulePack({
    organizationId: ids.org,
    sourceId: ids.source,
    applicabilityDecisionId: ids.applicability,
  });
  assert.deepEqual(
    [repeat.expected, repeat.created, repeat.reused, repeat.rebound],
    [58, 0, 58, 0],
  );
  assert.equal(repo.rules.length, 58);

  repo.decisions.push({
    ...applicability, id: ids.revision2, revision: 2,
  });
  const revised = await service.installRulePack({
    organizationId: ids.org,
    sourceId: ids.source,
    applicabilityDecisionId: ids.revision2,
  });
  assert.deepEqual(
    [revised.expected, revised.created, revised.reused, revised.rebound],
    [58, 0, 58, 58],
  );
  assert.equal(repo.rules.length, 58, "a revised applicability must not duplicate the pack");
  for (const rule of repo.rules) {
    assert.equal(rule.id, initialIds.get(rule.ruleCode));
    assert.equal(rule.applicabilityDecisionId, ids.revision2);
  }

  const eligible = await service.getSetup(ids.org, "2026-10-26");
  assert.equal(eligible.eligibleRules.length, 58);
  assert.equal((await service.getSetup(ids.org, "2013-02-14")).eligibleRules.length, 0);
  repo.decisions[1]!.decision = "not_applicable";
  assert.equal((await service.getSetup(ids.org, "2026-10-26")).eligibleRules.length, 0);
  await assert.rejects(
    service.installRulePack({
      organizationId: ids.org, sourceId: ids.source,
      applicabilityDecisionId: ids.revision2,
    }),
    ProfessionalWinterRulesError,
  );
  repo.decisions[1]!.decision = "applicable";

  const firstRule = repo.rules[0]!;
  const oldValue = firstRule.value;
  firstRule.value = "9.999";
  await assert.rejects(
    service.installRulePack({
      organizationId: ids.org, sourceId: ids.source,
      applicabilityDecisionId: ids.revision2,
    }),
    (err: unknown) => err instanceof ProfessionalWinterRulesError &&
      err.code === "conflicting_existing_rule",
  );
  firstRule.value = oldValue;
  const beforeExtra = repo.rules.length;
  repo.rules.push({
    ...firstRule,
    id: "40000000-0000-4000-8000-999999999999",
    ruleCode: "EXTRA",
  });
  await assert.rejects(
    service.installRulePack({
      organizationId: ids.org, sourceId: ids.source,
      applicabilityDecisionId: ids.revision2,
    }),
    (err: unknown) => err instanceof ProfessionalWinterRulesError &&
      err.code === "unexpected_existing_rule",
  );
  assert.equal(repo.rules.length, beforeExtra + 1);
  repo.rules.pop();

  repo.source!.officialStatus = "unknown";
  await assert.rejects(
    service.installRulePack({
      organizationId: ids.org, sourceId: ids.source,
      applicabilityDecisionId: ids.revision2,
    }),
    (err: unknown) => err instanceof ProfessionalWinterRulesError &&
      err.code === "invalid_source",
  );
  assert.equal((await service.getSetup(ids.org, "2026-10-26")).eligibleRules.length, 0);
  repo.source!.officialStatus = "in_force";
  assert.equal((await service.getSetup(ids.org, "2026-10-26")).eligibleRules.length, 58);

  console.log("M8.5C2B1 winter normative pack and governance checks passed.");
}

void main();
