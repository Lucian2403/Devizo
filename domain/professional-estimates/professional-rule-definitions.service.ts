import {
  parseDecimal,
  DecimalParseError,
  ESTIMATE_PERSPECTIVES,
  PROFESSIONAL_WORK_KINDS,
  PROFESSIONAL_RULE_ORIGINS,
  type ProfessionalCostStackComponent,
  type ProfessionalRuleCandidate,
} from "./calculation";
import {
  CompanyCalculationRuleSourceConflictError,
  ProfessionalRuleDefinitionValidationError,
} from "./professional-rule-definitions.error";
import type {
  ApplicabilityDecisionForRule,
  CompanyCalculationRuleSourceRecord,
  CreateProfessionalRuleDefinitionInput,
  ProfessionalRuleDefinitionRecord,
  ProfessionalRuleDefinitionRepository,
} from "./professional-rule-definitions.repository";
import { COMPANY_CALCULATION_RULE_SOURCE_IDENTITY } from "./professional-rule-definitions.repository";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SUPPORTED_CURRENCIES = ["MDL", "EUR", "RON", "USD", "GBP"] as const;
const OFFICIAL_ORIGINS = ["normative_sector_average", "statutory"] as const;
const RESOLVABLE_COMPONENTS: readonly ProfessionalCostStackComponent[] = [
  "labor_contributions",
  "material_transport",
  "procurement_storage",
  "overhead",
  "estimated_profit",
];
const COMPANY_RULE_COMPONENTS: readonly ProfessionalCostStackComponent[] = [
  "labor_contributions",
  "material_transport",
  "overhead",
  "estimated_profit",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertCompanyCalculationRuleSource(
  source: CompanyCalculationRuleSourceRecord,
  organizationId: string,
): void {
  if (
    source.organizationId !== organizationId ||
    source.code !== COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.code ||
    source.edition !== COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.edition ||
    source.title !== COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.title ||
    source.sourceType !== COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.sourceType ||
    source.jurisdiction !== COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.jurisdiction ||
    source.status !== COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.status ||
    source.officialStatus !== COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.officialStatus ||
    source.monitoringEnabled !== COMPANY_CALCULATION_RULE_SOURCE_IDENTITY.monitoringEnabled
  ) {
    throw new CompanyCalculationRuleSourceConflictError();
  }
}

function fail(
  code: string,
  message: string,
  field?: string,
): never {
  throw new ProfessionalRuleDefinitionValidationError(code, message, field);
}

function assertIsoDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    fail("invalid_date", `${field} must be a calendar date in YYYY-MM-DD form.`, field);
  }
  const parts = (value as string).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    fail("invalid_date", `${field} is not a valid calendar date.`, field);
  }
  return value as string;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * The component / value-type / basis contract the M8.3B cost stack can apply.
 * This mirrors the M8.3C resolver's `assertComponentSemantics` and the
 * `professional_rule_definitions` database CHECK constraint. `coefficient` is
 * never valid for these components.
 */
function isSupportedSemantics(
  component: string,
  valueType: string,
  basis: string,
): boolean {
  switch (component) {
    case "labor_contributions":
      return valueType === "percent" && basis === "labor_cost";
    case "material_transport":
      return (
        (valueType === "percent" && basis === "material_cost") ||
        (valueType === "fixed_amount" && basis === "fixed_amount")
      );
    case "procurement_storage":
      return valueType === "percent" && basis === "material_cost";
    case "overhead":
      return (
        valueType === "percent" &&
        (basis === "direct_cost" || basis === "labor_cost")
      );
    case "estimated_profit":
      return valueType === "percent" && basis === "estimate_cost_before_profit";
    default:
      return false;
  }
}

/**
 * Pure validation of a rule-definition input, independent of the database.
 * Returns a normalized input (trimmed strings, explicit nulls).
 */
export function validateRuleDefinitionInput(
  input: CreateProfessionalRuleDefinitionInput,
): CreateProfessionalRuleDefinitionInput {
  if (!nonEmpty(input.organizationId)) {
    fail("invalid_organization", "organizationId is required.", "organizationId");
  }
  if (!nonEmpty(input.sourceId)) {
    fail("invalid_source", "sourceId is required.", "sourceId");
  }
  if (!nonEmpty(input.name)) {
    fail("invalid_name", "name must be a non-empty string.", "name");
  }
  if (!RESOLVABLE_COMPONENTS.includes(input.component)) {
    fail(
      "invalid_component",
      `component must be one of: ${RESOLVABLE_COMPONENTS.join(", ")}.`,
      "component",
    );
  }
  if (input.valueType !== "percent" && input.valueType !== "fixed_amount") {
    // `coefficient` is intentionally unsupported for these components.
    fail(
      "invalid_value_type",
      "valueType must be percent or fixed_amount for these components.",
      "valueType",
    );
  }
  if (!isSupportedSemantics(input.component, input.valueType, input.calculationBasis)) {
    fail(
      "incompatible_rule_semantics",
      `combination is not valid for ${input.component}: valueType ${input.valueType} with basis ${input.calculationBasis}.`,
      "calculationBasis",
    );
  }

  let value: ReturnType<typeof parseDecimal>;
  try {
    value = parseDecimal(input.value, "value");
  } catch (error) {
    if (error instanceof DecimalParseError) {
      fail("invalid_decimal", error.message, "value");
    }
    throw error;
  }
  if (typeof input.value !== "string" || !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input.value.trim())) {
    fail("invalid_decimal", "value must be a plain decimal value.", "value");
  }
  const [integerPart = "", fractionPart = ""] = input.value.trim().replace(/^\+/, "").split(".");
  if (
    (integerPart.replace(/^0+/, "") || "0").length > 12 ||
    fractionPart.replace(/0+$/, "").length > 6
  ) {
    fail(
      "invalid_decimal_precision",
      "Valoarea poate avea maximum 12 cifre întregi și 6 zecimale.",
      "value",
    );
  }
  if (value.lessThan(0)) {
    fail("negative_value", "value must not be negative.", "value");
  }

  const currency = input.currency ?? null;
  if (input.valueType === "fixed_amount") {
    if (!nonEmpty(currency) || !SUPPORTED_CURRENCIES.includes(currency as never)) {
      fail(
        "invalid_currency",
        `A fixed_amount rule requires a supported currency: ${SUPPORTED_CURRENCIES.join(", ")}.`,
        "currency",
      );
    }
  } else if (currency !== null) {
    fail(
      "unexpected_currency",
      "A non-fixed_amount rule must not carry a currency.",
      "currency",
    );
  }

  const validFrom = assertIsoDate(input.validFrom, "validFrom");
  const validTo = input.validTo == null ? null : assertIsoDate(input.validTo, "validTo");
  if (validTo !== null && validTo < validFrom) {
    fail("invalid_validity_range", "validTo must not be before validFrom.", "validTo");
  }

  if (
    input.estimatePerspective !== "any" &&
    !ESTIMATE_PERSPECTIVES.includes(input.estimatePerspective)
  ) {
    fail(
      "invalid_perspective",
      `estimatePerspective must be "any" or one of: ${ESTIMATE_PERSPECTIVES.join(", ")}.`,
      "estimatePerspective",
    );
  }
  if (
    input.workKind !== "any" &&
    !PROFESSIONAL_WORK_KINDS.includes(input.workKind)
  ) {
    fail(
      "invalid_work_kind",
      `workKind must be "any" or one of: ${PROFESSIONAL_WORK_KINDS.join(", ")}.`,
      "workKind",
    );
  }
  if (!PROFESSIONAL_RULE_ORIGINS.includes(input.ruleOrigin)) {
    fail(
      "invalid_origin",
      `ruleOrigin must be one of: ${PROFESSIONAL_RULE_ORIGINS.join(", ")}.`,
      "ruleOrigin",
    );
  }

  const procurementCategory = input.procurementCategory ?? null;
  if (input.component === "procurement_storage") {
    if (!nonEmpty(procurementCategory)) {
      fail(
        "missing_procurement_category",
        'A procurement_storage rule requires an explicit procurementCategory (use "any" for a category-neutral rule).',
        "procurementCategory",
      );
    }
  } else if (procurementCategory !== null) {
    fail(
      "unexpected_procurement_category",
      "Only a procurement_storage rule may carry a procurementCategory.",
      "procurementCategory",
    );
  }

  const applicabilityDecisionId = input.applicabilityDecisionId ?? null;
  if (
    OFFICIAL_ORIGINS.includes(input.ruleOrigin as never) &&
    !nonEmpty(applicabilityDecisionId)
  ) {
    fail(
      "missing_applicability_decision",
      "An official rule (normative_sector_average or statutory) requires an applicabilityDecisionId.",
      "applicabilityDecisionId",
    );
  }

  const sourceReference = input.sourceReference ?? null;
  if (sourceReference !== null && !nonEmpty(sourceReference)) {
    fail(
      "blank_source_reference",
      "sourceReference must not be blank when supplied.",
      "sourceReference",
    );
  }
  const notes = input.notes ?? null;

  return {
    ...input,
    currency,
    validTo,
    applicabilityDecisionId,
    procurementCategory,
    sourceReference,
    notes,
  };
}

/**
 * Validates an official rule's applicability provenance against the linked
 * decision. The decision must exist for the same source, be `applicable`, and
 * its window must cover the rule's validity window.
 */
export function validateApplicabilityProvenance(
  rule: { validFrom: string; validTo?: string | null },
  decision: ApplicabilityDecisionForRule | null,
): void {
  if (decision == null) {
    fail(
      "applicability_decision_not_found",
      "The referenced applicability decision was not found for this organization and source.",
      "applicabilityDecisionId",
    );
    return;
  }
  if (decision.decision !== "applicable") {
    fail(
      "applicability_not_applicable",
      `An official rule requires an "applicable" decision; found "${decision.decision}".`,
      "applicabilityDecisionId",
    );
  }
  const validFrom = rule.validFrom;
  const validTo = rule.validTo ?? null;
  if (decision.applicableFrom != null && validFrom < decision.applicableFrom) {
    fail(
      "rule_before_applicable_from",
      "Rule validFrom must not be before the applicability decision applicableFrom.",
      "validFrom",
    );
  }
  if (decision.applicableUntil != null) {
    if (validTo === null) {
      fail(
        "rule_open_ended_past_applicable_until",
        "An open-ended rule validTo is invalid when the applicability decision has a finite applicableUntil.",
        "validTo",
      );
    } else if (validTo > decision.applicableUntil) {
      fail(
        "rule_past_applicable_until",
        "Rule validTo must not extend beyond the applicability decision applicableUntil.",
        "validTo",
      );
    }
  }
}

/**
 * Maps a persisted rule definition to an M8.3C `ProfessionalRuleCandidate`.
 *
 * `candidateId` is the definition row id. `calculationRuleId` is always null:
 * a reusable definition is NOT an applied `calculation_rules` row, and those two
 * identities must never be blurred. Decimal values remain strings.
 */
export function mapRuleDefinitionToCandidate(
  definition: ProfessionalRuleDefinitionRecord,
): ProfessionalRuleCandidate {
  return {
    candidateId: definition.id,
    component: definition.component,
    valueType: definition.valueType,
    value: definition.value,
    currency: definition.currency,
    calculationBasis: definition.calculationBasis,
    validFrom: definition.validFrom,
    validTo: definition.validTo,
    estimatePerspective: definition.estimatePerspective,
    workKind: definition.workKind,
    ruleOrigin: definition.ruleOrigin,
    procurementCategory: definition.procurementCategory,
    calculationRuleId: null,
    sourceId: definition.sourceId,
    sourceReference: definition.sourceReference,
    applicabilityDecisionId: definition.applicabilityDecisionId,
  };
}

export class ProfessionalRuleDefinitionService {
  constructor(
    private readonly repository: ProfessionalRuleDefinitionRepository,
  ) {}

  async ensureCompanyCalculationRuleSource(
    organizationId: string,
  ): Promise<CompanyCalculationRuleSourceRecord> {
    if (!UUID.test(organizationId)) {
      fail("invalid_organization", "Compania selectată nu este validă.");
    }
    let source =
      await this.repository.getCompanyCalculationRuleSource(organizationId);
    if (!source) {
      source =
        await this.repository.insertCompanyCalculationRuleSourceIfAbsent(
          organizationId,
        );
    }
    if (!source) {
      source =
        await this.repository.getCompanyCalculationRuleSource(organizationId);
    }
    if (!source) {
      throw new Error("Nu s-a putut pregăti sursa regulilor interne de calcul.");
    }
    assertCompanyCalculationRuleSource(source, organizationId);
    return source;
  }

  async createCompanyRuleDefinition(
    organizationId: string,
    input: Omit<
      CreateProfessionalRuleDefinitionInput,
      | "organizationId"
      | "sourceId"
      | "applicabilityDecisionId"
      | "ruleOrigin"
    >,
  ): Promise<ProfessionalRuleDefinitionRecord> {
    if (!UUID.test(organizationId)) {
      fail("invalid_organization", "Compania selectată nu este validă.");
    }
    if (!COMPANY_RULE_COMPONENTS.includes(input.component)) {
      fail(
        "invalid_component",
        "Regulile interne pot fi create doar pentru contribuții, transport materiale, cheltuieli de regie sau beneficiu estimat.",
        "component",
      );
    }
    const source = await this.ensureCompanyCalculationRuleSource(organizationId);
    return this.createRuleDefinition({
      ...input,
      organizationId,
      sourceId: source.id,
      applicabilityDecisionId: null,
      ruleOrigin: "company_individual",
    });
  }

  async createRuleDefinition(
    input: CreateProfessionalRuleDefinitionInput,
  ): Promise<ProfessionalRuleDefinitionRecord> {
    const normalized = validateRuleDefinitionInput(input);
    if (normalized.applicabilityDecisionId != null) {
      const decision = await this.repository.getApplicabilityDecisionForSource(
        normalized.organizationId,
        normalized.sourceId,
        normalized.applicabilityDecisionId,
      );
      validateApplicabilityProvenance(normalized, decision);
    }
    return this.repository.createRuleDefinition(normalized);
  }

  async getRuleDefinition(
    organizationId: string,
    id: string,
  ): Promise<ProfessionalRuleDefinitionRecord | null> {
    return this.repository.getRuleDefinition(organizationId, id);
  }

  /**
   * Revalidates the exact linked applicability decision for a persisted
   * definition. Official definitions must pass the M8.3D governance gate even
   * when reused by an installer; non-official origins require no such decision.
   */
  async validatePersistedDefinitionGovernance(
    definition: ProfessionalRuleDefinitionRecord,
  ): Promise<void> {
    if (!OFFICIAL_ORIGINS.includes(definition.ruleOrigin as never)) return;
    if (!nonEmpty(definition.applicabilityDecisionId)) {
      fail(
        "missing_applicability_decision",
        `Official rule definition ${definition.id} is missing its applicability decision link.`,
        "applicabilityDecisionId",
      );
    }
    const decision = await this.repository.getApplicabilityDecisionForSource(
      definition.organizationId,
      definition.sourceId,
      definition.applicabilityDecisionId as string,
    );
    validateApplicabilityProvenance(definition, decision);
  }

  /**
   * Loads curated definitions for a component and maps them to M8.3C
   * candidates. This layer never performs date/perspective/work-kind/currency/
   * category/origin matching; `resolveProfessionalRule` owns that.
   *
   * Official definitions (normative_sector_average, statutory) are re-gated at
   * load time: a persisted official definition must still point to an existing,
   * same-organization, same-source `applicable` decision whose window covers the
   * rule. This defends against rows written through RLS member INSERT/UPDATE or
   * migration/admin tooling. An invalid official definition fails explicitly
   * rather than being silently skipped. Automatic superseding/revision handling
   * remains deferred; the exact linked decision is still trusted.
   */
  async loadCandidatesForComponent(
    organizationId: string,
    component: ProfessionalCostStackComponent,
  ): Promise<ProfessionalRuleCandidate[]> {
    const definitions = await this.repository.listRuleDefinitionsForComponent(
      organizationId,
      component,
    );
    const candidates: ProfessionalRuleCandidate[] = [];
    for (const definition of definitions) {
      await this.validatePersistedDefinitionGovernance(definition);
      candidates.push(mapRuleDefinitionToCandidate(definition));
    }
    return candidates;
  }

  /**
   * Raw list of persisted rule-definition records for a component, WITHOUT the
   * official load-time governance gate applied by `loadCandidatesForComponent`.
   *
   * This is for administrative/installer use (for example idempotency checks in
   * an official rule pack), not for feeding the M8.3C resolver. Callers that
   * resolve rules must use `loadCandidatesForComponent`, which re-gates official
   * definitions.
   */
  async listDefinitionsForComponent(
    organizationId: string,
    component: ProfessionalCostStackComponent,
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    return this.repository.listRuleDefinitionsForComponent(
      organizationId,
      component,
    );
  }

  async listRuleDefinitionsForSource(
    organizationId: string,
    sourceId: string,
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    return this.repository.listRuleDefinitionsForSource(
      organizationId,
      sourceId,
    );
  }

  listRuleDefinitions(
    organizationId: string,
  ): Promise<ProfessionalRuleDefinitionRecord[]> {
    return this.repository.listRuleDefinitions(organizationId);
  }
}
