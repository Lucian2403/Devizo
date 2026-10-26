import {
  applyWinterConditionsToGeneralEstimate,
  calculateWinterConditions,
  calculateWinterConditionsBase,
  Decimal,
  WinterConditionsCalculationError,
  type ProfessionalGeneralEstimateTotals,
  type WinterConditionsBase,
  type WinterConditionsResult,
  type WinterPeriod,
} from "./calculation";
import {
  NCM_L_02_06_2012_RULE_PACK,
} from "./official-rule-packs/ncm-l-02-06-2012";
import type {
  PersistedWinterDecisionInput,
  ProfessionalWinterDecisionsRepository,
  SaveWinterDecisionInput,
  WinterDecisionRecord,
  WinterBuildingScope,
  WinterClassification,
} from "./professional-winter-decisions.repository";
import {
  ProfessionalWinterRulesService,
  type WinterRulesSetup,
} from "./professional-winter-rules.service";
import type { TemporaryWorksView } from "./professional-temporary-works.service";
import type { TemporaryWorksGeneralEstimateInput } from "./professional-temporary-works.repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;

export class ProfessionalWinterConditionsError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ProfessionalWinterConditionsError";
  }
}

function fail(code: string, message: string): never {
  throw new ProfessionalWinterConditionsError(code, message);
}

function dateValue(value: string): number {
  const match = DATE.exec(value);
  if (!match) return fail("invalid_project_date", "Folosiți date calendaristice în format AAAA-LL-ZZ.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return fail("invalid_project_date", "Perioada proiectului conține o dată invalidă.");
  }
  return date.getTime();
}

export function validateShortProject(
  startDate: string, endDate: string, winterDays: string, projectReference: string,
): { durationDays: string; winterDays: string; projectReference: string } {
  const start = dateValue(startDate);
  const end = dateValue(endDate);
  if (end < start) fail("invalid_project_period", "Data sfârșitului precedă începutul proiectului.");

  const startYear = Number(startDate.slice(0, 4));
  const startMonth = Number(startDate.slice(5, 7));
  const startDay = Number(startDate.slice(8, 10));
  const anniversary = Date.UTC(startYear + 1, startMonth - 1, startDay);
  if (end >= anniversary) {
    fail("not_short_project", "Metoda pentru proiect sub un an nu poate fi folosită la această durată.");
  }

  const duration = (end - start) / DAY_MS + 1;
  if (!/^\d+$/.test(winterDays) || winterDays.length > 3) {
    fail("invalid_winter_days", "Numărul zilelor cu temperaturi negative trebuie să fie întreg și pozitiv sau zero.");
  }
  const winter = Number(winterDays);
  if (!Number.isSafeInteger(winter) || winter > duration) {
    fail("invalid_winter_days", "Zilele de timp friguros nu pot depăși durata proiectului.");
  }
  const reference = projectReference.trim();
  if (!reference || reference.length > 4000) {
    fail("project_reference_required", "Indicați documentul din proiect care confirmă perioada și zilele de iarnă (maximum 4000 caractere).");
  }
  return { durationDays: String(duration), winterDays: String(winter), projectReference: reference };
}

function validateChoice(
  choice: {
    ruleDefinitionId: string;
    buildingScope: WinterBuildingScope;
    principalWorkConfirmed: boolean;
    classification: WinterClassification;
    analogyReference: string | null;
  },
  setup: WinterRulesSetup,
) {
  if (!UUID.test(choice.ruleDefinitionId)) fail("invalid_rule", "Selectați explicit poziția NCM.");
  const persisted = setup.eligibleRules.find((row) => row.id === choice.ruleDefinitionId);
  if (!persisted) {
    fail("stale_rule", "Regula selectată nu mai este eligibilă pentru data devizului.");
  }
  const official = NCM_L_02_06_2012_RULE_PACK.find((row) => row.ruleCode === persisted.ruleCode);
  if (!official ||
    new Decimal(persisted.value).eq(official.ratePercent) === false ||
    persisted.name !== official.name ||
    persisted.sourceReference !== official.sourceReference ||
    persisted.groupCode !== official.groupCode ||
    persisted.groupLabel !== official.groupLabel) {
    fail("modified_rule", "Regula salvată nu coincide cu pachetul NCM oficial. Verificați proveniența.");
  }
  if (!["other", "residential_administrative"].includes(choice.buildingScope)) {
    fail("invalid_building_scope", "Precizați categoria construcției.");
  }
  if (choice.buildingScope === "residential_administrative" &&
    !["022", "023"].includes(official.ruleCode)) {
    fail("incorrect_residential_rule", "Pentru clădiri de locuit sau administrative confirmați pozițiile 22–23 din NCM.");
  }
  if (official.principalWorkOnly && choice.principalWorkConfirmed !== true) {
    fail("principal_work_required", "Această poziție NCM poate fi aplicată numai lucrării principale confirmate.");
  }
  if (!["listed", "analogous"].includes(choice.classification)) {
    fail("invalid_classification", "Precizați dacă tipul este în tabel sau este ales prin analogie.");
  }
  const analogy = choice.analogyReference?.trim() ?? "";
  if (choice.classification === "analogous" && (!analogy || analogy.length > 4000)) {
    fail("analogy_reference_required", "Documentați explicit alegerea prin analogie (maximum 4000 caractere).");
  }
  return { persisted, analogyReference: choice.classification === "analogous" ? analogy : null };
}

export interface WinterConditionsView extends WinterRulesSetup {
  decision: WinterDecisionRecord | null;
  base: WinterConditionsBase | null;
  result: WinterConditionsResult | null;
  adjustedTotals: ProfessionalGeneralEstimateTotals | null;
  complete: boolean;
  error: string | null;
}

export class ProfessionalWinterConditionsService {
  constructor(
    private readonly repository: ProfessionalWinterDecisionsRepository,
    private readonly rulesService: ProfessionalWinterRulesService,
  ) {}

  async saveDecision(
    organizationId: string,
    generalEstimateId: string,
    input: SaveWinterDecisionInput,
  ): Promise<WinterDecisionRecord> {
    const estimate = await this.repository.getGeneralEstimate(organizationId, generalEstimateId);
    if (!estimate) fail("estimate_not_found", "Devizul general nu a fost găsit.");

    let normalized: PersistedWinterDecisionInput;
    if (input.mode === "not_applicable") {
      if (input.exclusionReason !== "heated_current_repair") {
        fail("invalid_exclusion", "Neaplicabilitatea necesită motivul legal explicit.");
      }
      normalized = {
        mode: "not_applicable", ruleDefinitionId: null, periodKind: null,
        startDate: null, endDate: null, winterDays: null,
        projectReference: null, buildingScope: null,
        principalWorkConfirmed: false, classification: null,
        analogyReference: null, exclusionReason: "heated_current_repair",
      };
    } else {
      const setup = await this.rulesService.getSetup(organizationId, estimate.valuationDate);
      const choice = validateChoice(input, setup);
      const period = input.period;
      if (period.kind !== "annual_average" && period.kind !== "short_project") {
        fail("invalid_period", "Selectați metoda de calcul pentru durata proiectului.");
      }
      const short = period.kind === "short_project"
        ? validateShortProject(
            period.startDate, period.endDate, period.winterDays, period.projectReference,
          )
        : null;
      normalized = {
        mode: "normative_rate",
        ruleDefinitionId: choice.persisted.id,
        periodKind: period.kind,
        startDate: period.kind === "short_project" ? period.startDate : null,
        endDate: period.kind === "short_project" ? period.endDate : null,
        winterDays: short ? Number(short.winterDays) : null,
        projectReference: short?.projectReference ?? null,
        buildingScope: input.buildingScope,
        principalWorkConfirmed: input.principalWorkConfirmed === true,
        classification: input.classification,
        analogyReference: choice.analogyReference,
        exclusionReason: null,
      };
    }
    return this.repository.saveDecision(organizationId, generalEstimateId, normalized);
  }

  async getView(
    organizationId: string,
    estimate: TemporaryWorksGeneralEstimateInput,
    temporaryWorks: TemporaryWorksView,
  ): Promise<WinterConditionsView> {
    const [setup, decision] = await Promise.all([
      this.rulesService.getSetup(organizationId, estimate.valuationDate),
      this.repository.getDecision(organizationId, estimate.id),
    ]);
    const incomplete = (message: string, base: WinterConditionsBase | null): WinterConditionsView => ({
      ...setup, decision, base, result: null, adjustedTotals: null, complete: false, error: message,
    });

    if (!estimate.complete || !temporaryWorks.adjustedGeneralCalculationComplete ||
      !temporaryWorks.adjustedTotals) {
      return incomplete("Finalizați mai întâi devizul general și capitolul 8 (construcții provizorii).", null);
    }
    const afterTemporary = temporaryWorks.adjustedTotals;
    const base = calculateWinterConditionsBase(afterTemporary);
    if (!decision) {
      return incomplete("Selectați explicit regula NCM pentru timp friguros sau motivul neaplicabilității.", base);
    }
    if (decision.mode === "not_applicable") {
      if (decision.exclusionReason !== "heated_current_repair") {
        return incomplete("Motivul neaplicabilității nu mai este valid.", base);
      }
      return { ...setup, decision, base, result: null,
        adjustedTotals: afterTemporary, complete: true, error: null };
    }
    try {
      if (!decision.ruleDefinitionId || !decision.buildingScope ||
        !decision.classification || !decision.periodKind) {
        fail("invalid_saved_decision", "Configurația salvată pentru timp friguros este incompletă.");
      }
      const chosen = validateChoice({
        ruleDefinitionId: decision.ruleDefinitionId,
        buildingScope: decision.buildingScope,
        principalWorkConfirmed: decision.principalWorkConfirmed,
        classification: decision.classification,
        analogyReference: decision.analogyReference,
      }, setup);
      let period: WinterPeriod;
      if (decision.periodKind === "annual_average") {
        period = { kind: "annual_average" };
      } else if (decision.periodKind === "short_project") {
        if (!decision.startDate || !decision.endDate ||
          decision.winterDays === null || !decision.projectReference) {
          fail("invalid_saved_period", "Datele calendarului de proiect nu sunt complete.");
        }
        const schedule = validateShortProject(
          decision.startDate, decision.endDate,
          String(decision.winterDays), decision.projectReference,
        );
        period = { kind: "short_project", ...schedule };
      } else {
        fail("invalid_saved_period", "Perioada proiectului nu este validă.");
      }
      const result = calculateWinterConditions({
        baseConstruction: base.construction,
        baseInstallation: base.installation,
        ratePercent: chosen.persisted.value,
        period,
      });
      return {
        ...setup, decision, base, result,
        adjustedTotals: applyWinterConditionsToGeneralEstimate(afterTemporary, result),
        complete: true, error: null,
      };
    } catch (error) {
      if (error instanceof ProfessionalWinterConditionsError ||
        error instanceof WinterConditionsCalculationError) {
        return incomplete(error.message, base);
      }
      throw error;
    }
  }
}
