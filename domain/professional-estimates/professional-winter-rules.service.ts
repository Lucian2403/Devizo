import { Decimal } from "./calculation";
import {
  NCM_L_02_06_2012_COMPONENT,
  NCM_L_02_06_2012_RULE_PACK,
  NCM_L_02_06_2012_SOURCE_CODE,
  NCM_L_02_06_2012_SOURCE_EDITION,
  NCM_L_02_06_2012_VALID_FROM,
} from "./official-rule-packs/ncm-l-02-06-2012";
import type {
  TemporaryWorksApplicabilityDecision,
  TemporaryWorksNormativeSource,
} from "./professional-temporary-works.repository";
import type {
  CreateWinterRuleDefinitionInput,
  ProfessionalWinterRulesRepository,
  WinterRuleDefinitionRecord,
} from "./professional-winter-rules.repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProfessionalWinterRulesError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ProfessionalWinterRulesError";
  }
}

export interface WinterRulesSetup {
  source: TemporaryWorksNormativeSource | null;
  applicabilityDecisions: TemporaryWorksApplicabilityDecision[];
  installedRules: WinterRuleDefinitionRecord[];
  eligibleRules: WinterRuleDefinitionRecord[];
  expectedRuleCount: number;
}

export interface WinterRulesInstallResult {
  expected: number;
  created: number;
  reused: number;
  rebound: number;
  definitions: WinterRuleDefinitionRecord[];
}

function error(code: string, message: string): never {
  throw new ProfessionalWinterRulesError(code, message);
}

function dateInRange(date: string, from: string | null, until: string | null) {
  return (!from || from <= date) && (!until || date <= until);
}

function correctSource(source: TemporaryWorksNormativeSource) {
  return (
    source.code === NCM_L_02_06_2012_SOURCE_CODE &&
    source.edition === NCM_L_02_06_2012_SOURCE_EDITION &&
    source.sourceType === "normative_document" &&
    source.jurisdiction === "MD" &&
    source.status === "active" &&
    source.officialStatus === "in_force" &&
    source.effectiveDate === NCM_L_02_06_2012_VALID_FROM &&
    source.validFrom === NCM_L_02_06_2012_VALID_FROM &&
    (source.validTo === null || source.validTo >= NCM_L_02_06_2012_VALID_FROM)
  );
}

function decisionCoversDate(
  decision: TemporaryWorksApplicabilityDecision,
  date: string,
) {
  return (
    decision.decision === "applicable" &&
    decision.officialStatus === "in_force" &&
    decision.sourceCode === NCM_L_02_06_2012_SOURCE_CODE &&
    decision.sourceEdition === NCM_L_02_06_2012_SOURCE_EDITION &&
    decision.applicableFrom !== null &&
    decision.applicableFrom <= date &&
    (decision.applicableUntil === null || decision.applicableUntil >= date)
  );
}

function eligible(
  rule: WinterRuleDefinitionRecord,
  source: TemporaryWorksNormativeSource,
  decisions: Map<string, TemporaryWorksApplicabilityDecision>,
  date: string,
) {
  const decision = decisions.get(rule.applicabilityDecisionId);
  return (
    rule.component === NCM_L_02_06_2012_COMPONENT &&
    rule.sourceId === source.id &&
    rule.organizationId === source.organizationId &&
    correctSource(source) &&
    dateInRange(date, source.validFrom, source.validTo) &&
    dateInRange(date, rule.validFrom, rule.validTo) &&
    decision !== undefined &&
    decision.sourceId === source.id &&
    decision.organizationId === source.organizationId &&
    decisionCoversDate(decision, date)
  );
}

function sameRule(
  persisted: WinterRuleDefinitionRecord,
  wanted: CreateWinterRuleDefinitionInput,
) {
  return (
    persisted.organizationId === wanted.organizationId &&
    persisted.sourceId === wanted.sourceId &&
    persisted.component === wanted.component &&
    persisted.ruleCode === wanted.ruleCode &&
    persisted.groupCode === wanted.groupCode &&
    persisted.groupLabel === wanted.groupLabel &&
    persisted.name === wanted.name &&
    persisted.valueType === wanted.valueType &&
    new Decimal(persisted.value).eq(new Decimal(wanted.value)) &&
    persisted.validFrom === wanted.validFrom &&
    persisted.validTo === wanted.validTo &&
    persisted.sourceReference === wanted.sourceReference
  );
}

export class ProfessionalWinterRulesService {
  constructor(private readonly repository: ProfessionalWinterRulesRepository) {}

  async getSetup(
    organizationId: string,
    valuationDate: string,
  ): Promise<WinterRulesSetup> {
    const source = await this.repository.findSourceByIdentity(
      organizationId,
      NCM_L_02_06_2012_SOURCE_CODE,
      NCM_L_02_06_2012_SOURCE_EDITION,
    );
    if (!source) {
      return {
        source: null, applicabilityDecisions: [], installedRules: [],
        eligibleRules: [], expectedRuleCount: NCM_L_02_06_2012_RULE_PACK.length,
      };
    }
    const [applicabilityDecisions, installedRules] = await Promise.all([
      this.repository.listApplicabilityDecisions(organizationId, source.id),
      this.repository.listRuleDefinitions(organizationId, source.id),
    ]);
    const decisions = new Map(applicabilityDecisions.map((item) => [item.id, item]));
    return {
      source, applicabilityDecisions, installedRules,
      eligibleRules: installedRules.filter((rule) =>
        eligible(rule, source, decisions, valuationDate),
      ),
      expectedRuleCount: NCM_L_02_06_2012_RULE_PACK.length,
    };
  }

  async installRulePack(input: {
    organizationId: string;
    sourceId: string;
    applicabilityDecisionId: string;
  }): Promise<WinterRulesInstallResult> {
    if (
      !UUID.test(input.organizationId) ||
      !UUID.test(input.sourceId) ||
      !UUID.test(input.applicabilityDecisionId)
    ) {
      error("invalid_identity", "Identificatorul companiei, sursei sau deciziei este invalid.");
    }

    const source = await this.repository.getSource(input.organizationId, input.sourceId);
    if (!source || source.organizationId !== input.organizationId || !correctSource(source)) {
      error(
        "invalid_source",
        "Este necesară sursa exactă NCM L.02.06-2012, ediția 2012, în vigoare din 15.02.2013.",
      );
    }
    const decision = await this.repository.getApplicabilityDecision(
      input.organizationId, source.id, input.applicabilityDecisionId,
    );
    if (
      !decision ||
      decision.organizationId !== input.organizationId ||
      decision.sourceId !== source.id ||
      !decisionCoversDate(decision, NCM_L_02_06_2012_VALID_FROM)
    ) {
      error(
        "invalid_applicability",
        "Selectați o decizie explicită «Aplicabilă» care acoperă 15.02.2013.",
      );
    }

    const existing = await this.repository.listRuleDefinitions(
      input.organizationId, source.id,
    );
    const wanted: CreateWinterRuleDefinitionInput[] =
      NCM_L_02_06_2012_RULE_PACK.map((rule) => ({
        organizationId: input.organizationId,
        sourceId: source.id,
        applicabilityDecisionId: decision.id,
        component: NCM_L_02_06_2012_COMPONENT,
        ruleCode: rule.ruleCode,
        groupCode: rule.groupCode,
        groupLabel: rule.groupLabel,
        name: rule.name,
        valueType: "percent",
        value: rule.ratePercent,
        validFrom: NCM_L_02_06_2012_VALID_FROM,
        validTo: null,
        sourceReference: rule.sourceReference,
      }));

    const recognized = new Set(wanted.map((row) => row.ruleCode));
    if (existing.some((row) => !recognized.has(row.ruleCode))) {
      error(
        "unexpected_existing_rule",
        "Există reguli suplimentare pentru componenta timp friguros; pachetul nu este modificat automat.",
      );
    }

    const missing: CreateWinterRuleDefinitionInput[] = [];
    const reused: WinterRuleDefinitionRecord[] = [];
    const rebindIds: string[] = [];
    for (const row of wanted) {
      const matches = existing.filter((item) => item.ruleCode === row.ruleCode);
      if (matches.length > 1) {
        error("duplicate_existing_rule", "Există reguli duplicate pentru poziția " + row.ruleCode + ".");
      }
      const found = matches[0];
      if (!found) {
        missing.push(row);
      } else {
        if (!sameRule(found, row)) {
          error(
            "conflicting_existing_rule",
            "Regula " + row.ruleCode + " diferă de norma oficială; nu o suprascriem.",
          );
        }
        reused.push(found);
        if (found.applicabilityDecisionId !== decision.id) {
          rebindIds.push(found.id);
        }
      }
    }

    const rebound = rebindIds.length
      ? await this.repository.rebindRuleDefinitionsApplicability(
          input.organizationId, source.id, rebindIds, decision.id,
        )
      : [];
    if (rebound.length !== rebindIds.length) {
      error("incomplete_rebind", "Actualizarea provenienței nu este completă.");
    }
    const byId = new Map(rebound.map((row) => [row.id, row]));
    const created = missing.length
      ? await this.repository.createRuleDefinitions(missing)
      : [];
    if (created.length !== missing.length) {
      error("incomplete_install", "Instalarea pachetului normativ nu este completă.");
    }
    return {
      expected: wanted.length,
      created: created.length,
      reused: reused.length,
      rebound: rebound.length,
      definitions: [...reused.map((row) => byId.get(row.id) ?? row), ...created]
        .sort((a, b) => a.ruleCode.localeCompare(b.ruleCode, "ro")),
    };
  }
}
