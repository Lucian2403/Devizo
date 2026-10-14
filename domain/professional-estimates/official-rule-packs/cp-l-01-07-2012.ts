import type {
  CreateProfessionalRuleDefinitionInput,
  ProfessionalRuleDefinitionRecord,
} from "../professional-rule-definitions.repository";
import type { ProfessionalRuleDefinitionService } from "../professional-rule-definitions.service";
import { DecimalParseError, parseDecimal } from "../calculation";
import { OfficialRulePackError } from "./official-rule-pack.error";

/**
 * First curated official normative rule pack: CP L.01.07-2012
 * "Instrucțiuni privind determinarea valorii cheltuielilor de
 * achiziționare-depozitare în construcții".
 *
 * Official E-DNC source page:   https://ednc.gov.md/cp-l-01-07-2012/
 * Official PDF:                 https://ednc.gov.md/wp-content/uploads/2023/06/CP-L.01.07-2012.pdf
 * Recorded official status:     in force; approved 2012-07-18; effective 2012-08-17; edition 2012.
 *
 * This pack materializes ONLY the verified investor sector-average
 * procurement/storage rates from clauses 3.2 and 3.3(a)/(c). It does not
 * implement the whole normative. See
 * docs/architecture/normative-pack-cp-l-01-07-2012.md for scope and rationale.
 *
 * These percentages are production normative data, NOT calculation-engine
 * defaults. They live here as explicit, provenance-bearing data and are never
 * hardcoded inside the generic M8.3A/B/C engines.
 */

export const CP_L_01_07_2012_SOURCE_CODE = "CP L.01.07-2012";
export const CP_L_01_07_2012_SOURCE_EDITION = "2012";

/** Explicit procurement/storage categories this pack distinguishes. */
export const CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS =
  "construction_materials";
export const CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES = "metal_structures";

/**
 * A single curated rule from the pack. These fields are the normative data; the
 * supplied organizationId, sourceId and applicabilityDecisionId are provenance
 * the caller binds at install time.
 */
export interface OfficialRulePackDefinition {
  name: string;
  component: "procurement_storage";
  valueType: "percent";
  value: string;
  currency: null;
  calculationBasis: "material_cost";
  validFrom: string;
  validTo: null;
  estimatePerspective: "investor";
  workKind: "any";
  ruleOrigin: "normative_sector_average";
  procurementCategory: string;
  sourceReference: string;
}

/**
 * The two investor sector-average procurement/storage rules.
 *
 * The 1.2% equipment ("utilaje") rate from clause 3.3(b) is intentionally
 * omitted: the current professional calculation model lacks an explicit,
 * safe equipment-cost base to map it to. Contractor rates are also NOT included:
 * under clause 3.5 a contractor may only use these sector averages by agreement,
 * which belongs to an explicitly opted-in `contract_agreed` flow later.
 */
export const CP_L_01_07_2012_RULE_PACK: readonly OfficialRulePackDefinition[] = [
  {
    name: "Cheltuieli de achiziționare-depozitare — materiale de construcții (investitor)",
    component: "procurement_storage",
    valueType: "percent",
    value: "2",
    currency: null,
    calculationBasis: "material_cost",
    validFrom: "2012-08-17",
    validTo: null,
    estimatePerspective: "investor",
    workKind: "any",
    ruleOrigin: "normative_sector_average",
    procurementCategory: CP_L_01_07_2012_CATEGORY_CONSTRUCTION_MATERIALS,
    sourceReference: "CP L.01.07-2012, pct. 3.2, 3.3(a)",
  },
  {
    name: "Cheltuieli de achiziționare-depozitare — structuri metalice (investitor)",
    component: "procurement_storage",
    valueType: "percent",
    value: "0.75",
    currency: null,
    calculationBasis: "material_cost",
    validFrom: "2012-08-17",
    validTo: null,
    estimatePerspective: "investor",
    workKind: "any",
    ruleOrigin: "normative_sector_average",
    procurementCategory: CP_L_01_07_2012_CATEGORY_METAL_STRUCTURES,
    sourceReference: "CP L.01.07-2012, pct. 3.2, 3.3(c)",
  },
];

/**
 * The minimal persisted normative source a pack installer must inspect before
 * attaching rules. Implemented by both NormativeIntelligenceService and the
 * Drizzle normative-intelligence repository.
 */
export interface NormativeSourceReader {
  getSource(
    organizationId: string,
    sourceId: string,
  ): Promise<{
    id: string;
    organizationId: string;
    code: string;
    edition: string;
  } | null>;
}

export interface InstallCpL010720112RulePackInput {
  organizationId: string;
  /** The exact persisted source id the caller verified is CP L.01.07-2012. */
  sourceId: string;
  /** The exact applicability decision governing these official rules. */
  applicabilityDecisionId: string;
}

export interface InstalledRulePackDefinition {
  procurementCategory: string;
  definition: ProfessionalRuleDefinitionRecord;
  /** True when an exact matching definition already existed and was reused. */
  reused: boolean;
}

export interface InstallCpL010720112RulePackResult {
  sourceId: string;
  applicabilityDecisionId: string;
  definitions: InstalledRulePackDefinition[];
}

/** Fields that identify the same curated pack "slot" for idempotency. */
const SLOT_FIELDS = [
  "sourceId",
  "applicabilityDecisionId",
  "component",
  "procurementCategory",
  "estimatePerspective",
] as const;

/** Fields whose divergence within one slot is a conflict, never an update. */
const VALUE_FIELDS = [
  "name",
  "value",
  "valueType",
  "calculationBasis",
  "currency",
  "validFrom",
  "validTo",
  "workKind",
  "ruleOrigin",
  "sourceReference",
  "notes",
] as const;

/**
 * Installs the CP L.01.07-2012 investor sector-average procurement/storage
 * rules.
 *
 * Source identity gate: the caller supplies the exact sourceId. The installer
 * loads it and refuses to attach rules unless it is the same organization's
 * CP L.01.07-2012 / edition 2012 source. It never infers or creates an
 * applicability decision and never does a "latest source wins" lookup.
 *
 * Governance: each definition is official (`normative_sector_average`) and is
 * created through the rule-definition service, which re-validates the supplied
 * applicabilityDecisionId against the M8.3D governance gate.
 *
 * Idempotency: re-installing the same pack with the same organization, sourceId
 * and applicabilityDecisionId reuses existing exact definitions. A persisted
 * definition occupying the same pack slot with a conflicting value or semantics
 * fails explicitly; it is never mutated.
 */
export class CpL010720112RulePackInstaller {
  constructor(
    private readonly sourceReader: NormativeSourceReader,
    private readonly ruleDefinitionService: ProfessionalRuleDefinitionService,
  ) {}

  async install(
    input: InstallCpL010720112RulePackInput,
  ): Promise<InstallCpL010720112RulePackResult> {
    const { organizationId, sourceId, applicabilityDecisionId } = input;

    const source = await this.sourceReader.getSource(organizationId, sourceId);
    if (source == null) {
      throw new OfficialRulePackError(
        "source_not_found",
        `Normative source ${sourceId} was not found for this organization.`,
        "sourceId",
      );
    }
    if (source.organizationId !== organizationId) {
      throw new OfficialRulePackError(
        "source_organization_mismatch",
        "The normative source belongs to a different organization.",
        "organizationId",
      );
    }
    if (source.code !== CP_L_01_07_2012_SOURCE_CODE) {
      throw new OfficialRulePackError(
        "source_code_mismatch",
        `Expected source code ${CP_L_01_07_2012_SOURCE_CODE}, but source ${sourceId} is ${source.code}.`,
        "code",
      );
    }
    if (source.edition !== CP_L_01_07_2012_SOURCE_EDITION) {
      throw new OfficialRulePackError(
        "source_edition_mismatch",
        `Expected source edition ${CP_L_01_07_2012_SOURCE_EDITION}, but source ${sourceId} is ${source.edition}.`,
        "edition",
      );
    }

    const existing =
      await this.ruleDefinitionService.listDefinitionsForComponent(
        organizationId,
        "procurement_storage",
      );

    const preflight = CP_L_01_07_2012_RULE_PACK.map((packRule) => {
      const desired: CreateProfessionalRuleDefinitionInput = {
        organizationId,
        sourceId,
        applicabilityDecisionId,
        name: packRule.name,
        component: packRule.component,
        valueType: packRule.valueType,
        value: packRule.value,
        currency: packRule.currency,
        calculationBasis: packRule.calculationBasis,
        validFrom: packRule.validFrom,
        validTo: packRule.validTo,
        estimatePerspective: packRule.estimatePerspective,
        workKind: packRule.workKind,
        ruleOrigin: packRule.ruleOrigin,
        procurementCategory: packRule.procurementCategory,
        sourceReference: packRule.sourceReference,
        notes: null,
      };

      const slotMatches = existing.filter((record) =>
        occupiesSameSlot(record, desired),
      );

      const hasConflict = slotMatches.some(
        (record) => !matchesPackValues(record, desired),
      );
      return {
        packRule,
        desired,
        exact: hasConflict
          ? null
          : (slotMatches[0] ?? null),
        duplicate: slotMatches.length > 1,
        hasConflict,
      };
    });

    const duplicate = preflight.find((entry) => entry.duplicate);
    if (duplicate) {
      throw new OfficialRulePackError(
        "duplicate_existing_definition",
        `Multiple persisted procurement/storage definitions occupy category ${duplicate.packRule.procurementCategory} under source ${sourceId} and applicability decision ${applicabilityDecisionId}; refusing to choose one.`,
        "procurementCategory",
      );
    }

    const conflict = preflight.find((entry) => entry.hasConflict);
    if (conflict) {
      throw new OfficialRulePackError(
        "conflicting_existing_definition",
        `A persisted procurement/storage definition for category ${conflict.packRule.procurementCategory} under source ${sourceId} and applicability decision ${applicabilityDecisionId} already exists with conflicting values; refusing to mutate official normative data.`,
        "procurementCategory",
      );
    }

    // Re-gate every reusable official record before creating any missing rows.
    for (const entry of preflight) {
      if (entry.exact) {
        await this.ruleDefinitionService.validatePersistedDefinitionGovernance(
          entry.exact,
        );
      }
    }

    const definitions: InstalledRulePackDefinition[] = [];
    for (const entry of preflight) {
      const definition =
        entry.exact ??
        (await this.ruleDefinitionService.createRuleDefinition(entry.desired));
      definitions.push({
        procurementCategory: entry.packRule.procurementCategory,
        definition,
        reused: entry.exact !== null,
      });
    }

    return { sourceId, applicabilityDecisionId, definitions };
  }
}

function occupiesSameSlot(
  record: ProfessionalRuleDefinitionRecord,
  desired: CreateProfessionalRuleDefinitionInput,
): boolean {
  return SLOT_FIELDS.every(
    (field) =>
      normalizeField(record[field]) === normalizeField(desired[field]),
  );
}

function matchesPackValues(
  record: ProfessionalRuleDefinitionRecord,
  desired: CreateProfessionalRuleDefinitionInput,
): boolean {
  return VALUE_FIELDS.every((field) => {
    if (field === "value") {
      try {
        return parseDecimal(record.value, "value").equals(
          parseDecimal(desired.value, "value"),
        );
      } catch (error) {
        if (error instanceof DecimalParseError) return false;
        throw error;
      }
    }
    return normalizeField(record[field]) === normalizeField(desired[field]);
  });
}

function normalizeField(value: unknown): string | null {
  return value == null ? null : String(value);
}
