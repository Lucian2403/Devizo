import {
  applyTemporaryWorksToGeneralEstimate,
  calculateProjectTemporaryWorks,
  calculateTemporaryWorks,
  calculateTemporaryWorksBase,
  calculateZeroTemporaryWorks,
  Decimal,
  DecimalParseError,
  parseDecimal,
  TemporaryWorksCalculationError,
  TEMPORARY_WORKS_PROJECT_CONDITIONS,
  type ProfessionalGeneralEstimateTotals,
  type TemporaryWorksProjectCondition,
  type TemporaryWorksResult,
} from "./calculation";
import {
  NCM_L_02_05_2012_COMPONENT,
  NCM_L_02_05_2012_RULE_PACK,
  NCM_L_02_05_2012_SOURCE_CODE,
  NCM_L_02_05_2012_SOURCE_EDITION,
  NCM_L_02_05_2012_VALID_FROM,
} from "./official-rule-packs/ncm-l-02-05-2012";
import type {
  CreateProfessionalGeneralRuleDefinitionInput,
  ProfessionalGeneralCostDecisionRecord,
  ProfessionalGeneralRuleDefinitionRecord,
  ProfessionalTemporaryWorksRepository,
  SaveProfessionalGeneralCostDecisionInput,
  TemporaryWorksApplicabilityDecision,
  TemporaryWorksGeneralEstimateInput,
  TemporaryWorksNormativeSource,
} from "./professional-temporary-works.repository";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAIN_DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

export class ProfessionalTemporaryWorksError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ProfessionalTemporaryWorksError";
  }
}

export interface TemporaryWorksSetup {
  source: TemporaryWorksNormativeSource | null;
  applicabilityDecisions: TemporaryWorksApplicabilityDecision[];
  installedRules: ProfessionalGeneralRuleDefinitionRecord[];
  eligibleRules: ProfessionalGeneralRuleDefinitionRecord[];
  expectedRuleCount: number;
}

export interface TemporaryWorksEvaluation {
  baseAggregationComplete: boolean;
  temporaryWorksComplete: boolean;
  adjustedGeneralCalculationComplete: boolean;
  base: {
    construction: string;
    installation: string;
    combined: string;
  } | null;
  decision: ProfessionalGeneralCostDecisionRecord | null;
  result: TemporaryWorksResult | null;
  adjustedTotals: ProfessionalGeneralEstimateTotals | null;
  error: string | null;
}

export interface TemporaryWorksView extends TemporaryWorksSetup, TemporaryWorksEvaluation {}

export interface TemporaryWorksInstallResult {
  expected: number;
  created: number;
  reused: number;
  rebound: number;
  definitions: ProfessionalGeneralRuleDefinitionRecord[];
}

function fail(code: string, message: string, field?: string): never {
  throw new ProfessionalTemporaryWorksError(code, message, field);
}

function sameDecimal(left: string, right: string): boolean {
  try {
    return new Decimal(left).equals(new Decimal(right));
  } catch {
    return false;
  }
}

function parseProjectAmount(value: string, field: string): string {
  const normalized = value.trim();
  if (!PLAIN_DECIMAL.test(normalized)) {
    fail("invalid_decimal", `${field} trebuie să fie o valoare zecimală pozitivă sau zero.`, field);
  }
  const [integerPart = "", fractionPart = ""] = normalized.split(".");
  if (
    (integerPart.replace(/^0+/, "") || "0").length > 12 ||
    fractionPart.replace(/0+$/, "").length > 6
  ) {
    fail(
      "invalid_decimal_precision",
      `${field} poate avea maximum 12 cifre întregi și 6 zecimale.`,
      field,
    );
  }
  try {
    const parsed = parseDecimal(normalized, field);
    if (parsed.isNegative()) {
      fail("negative_amount", `${field} nu poate fi negativă.`, field);
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof DecimalParseError) {
      fail("invalid_decimal", error.message, field);
    }
    throw error;
  }
}

function dateInRange(
  date: string,
  validFrom: string | null,
  validTo: string | null,
): boolean {
  if (validFrom && date < validFrom) return false;
  if (validTo && date > validTo) return false;
  return true;
}

function sourceMatches(source: TemporaryWorksNormativeSource): boolean {
  return (
    source.code === NCM_L_02_05_2012_SOURCE_CODE &&
    source.edition === NCM_L_02_05_2012_SOURCE_EDITION &&
    source.sourceType === "normative_document" &&
    source.jurisdiction === "MD" &&
    source.status === "active" &&
    source.officialStatus === "in_force" &&
    source.effectiveDate === NCM_L_02_05_2012_VALID_FROM &&
    source.validFrom === NCM_L_02_05_2012_VALID_FROM &&
    (source.validTo === null || source.validTo >= NCM_L_02_05_2012_VALID_FROM)
  );
}

function decisionCoversDate(
  decision: TemporaryWorksApplicabilityDecision,
  date: string,
): boolean {
  return (
    decision.decision === "applicable" &&
    decision.officialStatus === "in_force" &&
    decision.sourceCode === NCM_L_02_05_2012_SOURCE_CODE &&
    decision.sourceEdition === NCM_L_02_05_2012_SOURCE_EDITION &&
    decision.applicableFrom !== null &&
    decision.applicableFrom <= date &&
    (decision.applicableUntil === null || decision.applicableUntil >= date)
  );
}

function isRuleEligible(
  rule: ProfessionalGeneralRuleDefinitionRecord,
  source: TemporaryWorksNormativeSource,
  decisions: Map<string, TemporaryWorksApplicabilityDecision>,
  valuationDate: string,
): boolean {
  const decision = decisions.get(rule.applicabilityDecisionId);
  return (
    sourceMatches(source) &&
    dateInRange(valuationDate, source.validFrom, source.validTo) &&
    dateInRange(valuationDate, rule.validFrom, rule.validTo) &&
    decision !== undefined &&
    decision.sourceId === source.id &&
    decisionCoversDate(decision, valuationDate)
  );
}

function matchesPackRule(
  persisted: ProfessionalGeneralRuleDefinitionRecord,
  desired: CreateProfessionalGeneralRuleDefinitionInput,
): boolean {
  return (
    persisted.organizationId === desired.organizationId &&
    persisted.sourceId === desired.sourceId &&
    persisted.component === desired.component &&
    persisted.ruleCode === desired.ruleCode &&
    persisted.groupCode === desired.groupCode &&
    persisted.groupLabel === desired.groupLabel &&
    persisted.name === desired.name &&
    persisted.valueType === desired.valueType &&
    sameDecimal(persisted.value, desired.value) &&
    persisted.validFrom === desired.validFrom &&
    persisted.validTo === desired.validTo &&
    persisted.sourceReference === desired.sourceReference
  );
}

function validProjectCondition(
  value: string,
): value is TemporaryWorksProjectCondition {
  return TEMPORARY_WORKS_PROJECT_CONDITIONS.some((item) => item.value === value);
}

export class ProfessionalTemporaryWorksService {
  constructor(private readonly repository: ProfessionalTemporaryWorksRepository) {}

  async getSetup(
    organizationId: string,
    valuationDate: string,
  ): Promise<TemporaryWorksSetup> {
    const source = await this.repository.findSourceByIdentity(
      organizationId,
      NCM_L_02_05_2012_SOURCE_CODE,
      NCM_L_02_05_2012_SOURCE_EDITION,
    );
    if (!source) {
      return {
        source: null,
        applicabilityDecisions: [],
        installedRules: [],
        eligibleRules: [],
        expectedRuleCount: NCM_L_02_05_2012_RULE_PACK.length,
      };
    }
    const [applicabilityDecisions, installedRules] = await Promise.all([
      this.repository.listApplicabilityDecisions(organizationId, source.id),
      this.repository.listRuleDefinitions(organizationId, source.id),
    ]);
    const decisions = new Map(
      applicabilityDecisions.map((decision) => [decision.id, decision]),
    );
    return {
      source,
      applicabilityDecisions,
      installedRules,
      eligibleRules: installedRules.filter((rule) =>
        isRuleEligible(rule, source, decisions, valuationDate),
      ),
      expectedRuleCount: NCM_L_02_05_2012_RULE_PACK.length,
    };
  }

  async installRulePack(input: {
    organizationId: string;
    sourceId: string;
    applicabilityDecisionId: string;
  }): Promise<TemporaryWorksInstallResult> {
    if (!UUID.test(input.organizationId) || !UUID.test(input.sourceId)) {
      fail("invalid_identity", "Compania sau sursa normativă nu este validă.");
    }
    if (!UUID.test(input.applicabilityDecisionId)) {
      fail(
        "invalid_applicability_decision",
        "Decizia de aplicabilitate nu este validă.",
        "applicabilityDecisionId",
      );
    }

    const source = await this.repository.getSource(
      input.organizationId,
      input.sourceId,
    );
    if (!source) {
      fail("source_not_found", "Sursa NCM L.02.05-2012 nu a fost găsită.");
    }
    if (!sourceMatches(source)) {
      fail(
        "source_identity_mismatch",
        "Sursa selectată nu corespunde exact NCM L.02.05-2012, ediția 2012, în vigoare din 15.02.2013.",
      );
    }

    const decision = await this.repository.getApplicabilityDecision(
      input.organizationId,
      source.id,
      input.applicabilityDecisionId,
    );
    if (!decision || decision.sourceId !== source.id) {
      fail(
        "applicability_decision_not_found",
        "Decizia de aplicabilitate nu aparține acestei surse normative.",
      );
    }
    if (!decisionCoversDate(decision, NCM_L_02_05_2012_VALID_FROM)) {
      fail(
        "applicability_not_eligible",
        "Pentru instalarea pachetului este necesară o decizie «Aplicabilă» care acoperă data de intrare în vigoare 15.02.2013.",
      );
    }

    const existing = await this.repository.listRuleDefinitions(
      input.organizationId,
      source.id,
    );

    const desired = NCM_L_02_05_2012_RULE_PACK.map(
      (rule): CreateProfessionalGeneralRuleDefinitionInput => ({
        organizationId: input.organizationId,
        sourceId: source.id,
        applicabilityDecisionId: decision.id,
        component: NCM_L_02_05_2012_COMPONENT,
        ruleCode: rule.ruleCode,
        groupCode: rule.groupCode,
        groupLabel: rule.groupLabel,
        name: rule.name,
        valueType: "percent",
        value: rule.ratePercent,
        validFrom: NCM_L_02_05_2012_VALID_FROM,
        validTo: null,
        sourceReference: rule.sourceReference,
      }),
    );

    const missing: CreateProfessionalGeneralRuleDefinitionInput[] = [];
    const reused: ProfessionalGeneralRuleDefinitionRecord[] = [];
    const rebindIds: string[] = [];

    for (const row of desired) {
      const matches = existing.filter((item) => item.ruleCode === row.ruleCode);
      if (matches.length > 1) {
        fail(
          "duplicate_existing_rule",
          `Există mai multe reguli persistate pentru poziția ${row.ruleCode}; rulați migrarea de reparare înainte de verificarea pachetului.`,
        );
      }

      const persisted = matches[0];
      if (!persisted) {
        missing.push(row);
        continue;
      }
      if (!matchesPackRule(persisted, row)) {
        fail(
          "conflicting_existing_rule",
          `Regula persistată ${row.ruleCode} diferă de pachetul oficial; datele normative nu sunt suprascrise automat.`,
        );
      }

      reused.push(persisted);
      if (persisted.applicabilityDecisionId !== decision.id) {
        rebindIds.push(persisted.id);
      }
    }

    const rebound =
      rebindIds.length === 0
        ? []
        : await this.repository.rebindRuleDefinitionsApplicability(
            input.organizationId,
            source.id,
            rebindIds,
            decision.id,
          );
    const reboundById = new Map(rebound.map((rule) => [rule.id, rule]));
    const currentReused = reused.map(
      (rule) => reboundById.get(rule.id) ?? rule,
    );

    const created =
      missing.length === 0
        ? []
        : await this.repository.createRuleDefinitions(missing);

    return {
      expected: desired.length,
      created: created.length,
      reused: currentReused.length,
      rebound: rebound.length,
      definitions: [...currentReused, ...created].sort((a, b) =>
        a.ruleCode.localeCompare(b.ruleCode, "ro"),
      ),
    };
  }

  async saveDecision(
    organizationId: string,
    generalEstimateId: string,
    input:
      | {
          mode: "normative_rate";
          ruleDefinitionId: string;
          projectCondition: string;
        }
      | {
          mode: "project_calculation";
          projectConstructionAmount: string;
          projectInstallationAmount: string;
          projectReference: string;
        },
  ): Promise<ProfessionalGeneralCostDecisionRecord> {
    const estimate = await this.repository.getGeneralEstimate(
      organizationId,
      generalEstimateId,
    );
    if (!estimate) {
      fail("general_estimate_not_found", "Devizul general nu a fost găsit.");
    }

    let normalized: SaveProfessionalGeneralCostDecisionInput;
    if (input.mode === "normative_rate") {
      if (!UUID.test(input.ruleDefinitionId)) {
        fail("invalid_rule", "Selectați explicit o regulă NCM.", "ruleDefinitionId");
      }
      if (!validProjectCondition(input.projectCondition)) {
        fail(
          "invalid_project_condition",
          "Selectați explicit condiția proiectului.",
          "projectCondition",
        );
      }
      const rule = await this.repository.getRuleDefinition(
        organizationId,
        input.ruleDefinitionId,
      );
      if (!rule) {
        fail("rule_not_found", "Regula NCM selectată nu mai este disponibilă.");
      }
      const source = await this.repository.getSource(organizationId, rule.sourceId);
      const applicability = await this.repository.getApplicabilityDecision(
        organizationId,
        rule.sourceId,
        rule.applicabilityDecisionId,
      );
      if (
        !source ||
        !applicability ||
        !isRuleEligible(
          rule,
          source,
          new Map([[applicability.id, applicability]]),
          estimate.valuationDate,
        )
      ) {
        fail(
          "rule_not_eligible",
          "Regula NCM selectată nu este eligibilă pentru data acestui deviz general.",
        );
      }
      normalized = {
        mode: "normative_rate",
        ruleDefinitionId: rule.id,
        projectCondition: input.projectCondition,
      };
    } else {
      const construction = parseProjectAmount(
        input.projectConstructionAmount,
        "Valoarea lucrărilor de construcții",
      );
      const installation = parseProjectAmount(
        input.projectInstallationAmount,
        "Valoarea lucrărilor de montaj",
      );
      if (new Decimal(construction).plus(installation).isZero()) {
        fail(
          "empty_project_calculation",
          "Calculul conform proiectului trebuie să conțină cel puțin o valoare mai mare decât zero.",
        );
      }
      const projectReference = input.projectReference.trim();
      if (!projectReference) {
        fail(
          "project_reference_required",
          "Indicați referința la calculul din proiect.",
          "projectReference",
        );
      }
      if (projectReference.length > 4000) {
        fail(
          "project_reference_too_long",
          "Referința la calculul din proiect nu poate depăși 4000 de caractere.",
          "projectReference",
        );
      }
      normalized = {
        mode: "project_calculation",
        projectConstructionAmount: construction,
        projectInstallationAmount: installation,
        projectReference,
      };
    }

    return this.repository.saveDecision(
      organizationId,
      generalEstimateId,
      normalized,
    );
  }

  async getView(
    organizationId: string,
    estimate: TemporaryWorksGeneralEstimateInput,
  ): Promise<TemporaryWorksView> {
    const setup = await this.getSetup(organizationId, estimate.valuationDate);
    const decision = await this.repository.getDecision(
      organizationId,
      estimate.id,
    );

    if (!estimate.complete || !estimate.totals) {
      return {
        ...setup,
        baseAggregationComplete: false,
        temporaryWorksComplete: false,
        adjustedGeneralCalculationComplete: false,
        base: null,
        decision,
        result: null,
        adjustedTotals: null,
        error: "Devizul general de bază este incomplet.",
      };
    }

    const base = calculateTemporaryWorksBase(estimate.totals);
    if (new Decimal(base.combined).isZero()) {
      const result = calculateZeroTemporaryWorks(base);
      return {
        ...setup,
        baseAggregationComplete: true,
        temporaryWorksComplete: true,
        adjustedGeneralCalculationComplete: true,
        base,
        decision,
        result,
        adjustedTotals: applyTemporaryWorksToGeneralEstimate(
          estimate.totals,
          result,
        ),
        error: null,
      };
    }

    if (!decision) {
      return {
        ...setup,
        baseAggregationComplete: true,
        temporaryWorksComplete: false,
        adjustedGeneralCalculationComplete: false,
        base,
        decision: null,
        result: null,
        adjustedTotals: null,
        error:
          "Configurați explicit cheltuielile pentru clădiri și construcții speciale provizorii.",
      };
    }

    try {
      let result: TemporaryWorksResult;
      if (decision.mode === "project_calculation") {
        if (
          decision.projectConstructionAmount === null ||
          decision.projectInstallationAmount === null ||
          !decision.projectReference
        ) {
          throw new ProfessionalTemporaryWorksError(
            "invalid_persisted_decision",
            "Calculul conform proiectului este incomplet.",
          );
        }
        result = calculateProjectTemporaryWorks({
          baseConstruction: base.construction,
          baseInstallation: base.installation,
          projectConstructionAmount: decision.projectConstructionAmount,
          projectInstallationAmount: decision.projectInstallationAmount,
        });
      } else {
        if (!decision.ruleDefinitionId || !decision.projectCondition) {
          throw new ProfessionalTemporaryWorksError(
            "invalid_persisted_decision",
            "Selecția normativă pentru construcțiile provizorii este incompletă.",
          );
        }
        const rule = await this.repository.getRuleDefinition(
          organizationId,
          decision.ruleDefinitionId,
        );
        if (!rule) {
          throw new ProfessionalTemporaryWorksError(
            "stale_rule",
            "Regula NCM selectată nu mai este disponibilă.",
          );
        }
        const source = setup.source;
        const applicability = setup.applicabilityDecisions.find(
          (item) => item.id === rule.applicabilityDecisionId,
        );
        if (
          !source ||
          !applicability ||
          !isRuleEligible(
            rule,
            source,
            new Map([[applicability.id, applicability]]),
            estimate.valuationDate,
          )
        ) {
          throw new ProfessionalTemporaryWorksError(
            "stale_rule",
            "Regula NCM salvată nu mai este eligibilă. Devizo nu selectează automat o altă regulă.",
          );
        }
        result = calculateTemporaryWorks({
          baseConstruction: base.construction,
          baseInstallation: base.installation,
          ratePercent: rule.value,
          projectCondition: decision.projectCondition,
        });
      }

      return {
        ...setup,
        baseAggregationComplete: true,
        temporaryWorksComplete: true,
        adjustedGeneralCalculationComplete: true,
        base,
        decision,
        result,
        adjustedTotals: applyTemporaryWorksToGeneralEstimate(
          estimate.totals,
          result,
        ),
        error: null,
      };
    } catch (error) {
      if (
        error instanceof ProfessionalTemporaryWorksError ||
        error instanceof TemporaryWorksCalculationError
      ) {
        return {
          ...setup,
          baseAggregationComplete: true,
          temporaryWorksComplete: false,
          adjustedGeneralCalculationComplete: false,
          base,
          decision,
          result: null,
          adjustedTotals: null,
          error: error.message,
        };
      }
      throw error;
    }
  }
}
