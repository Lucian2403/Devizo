import {
  calculateGeneralReserve,
  GENERAL_RESERVE_RATES,
  type GeneralReserveCategory,
  type GeneralReserveResult,
  type ProfessionalGeneralEstimateTotals,
} from "./calculation";
import type {
  TemporaryWorksApplicabilityDecision,
  TemporaryWorksNormativeSource,
} from "./professional-temporary-works.repository";
import type {
  GeneralReserveDecisionRecord,
  ProfessionalGeneralReserveRepository,
} from "./professional-general-reserve.repository";

export const CP_L_01_01_2012 = {
  code: "CP L.01.01-2012",
  edition: "2012",
  effectiveDate: "2013-02-15",
  reference: "CP L.01.01-2012, pct. 6.11",
  sourceUri: "https://ednc.gov.md/cp-l-01-01-2012/",
} as const;

export class ProfessionalGeneralReserveError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ProfessionalGeneralReserveError";
  }
}

function fail(code: string, message: string): never {
  throw new ProfessionalGeneralReserveError(code, message);
}

function eligibleSource(
  source: TemporaryWorksNormativeSource | null,
  valuationDate: string,
): source is TemporaryWorksNormativeSource {
  return Boolean(source &&
    source.code === CP_L_01_01_2012.code &&
    source.edition === CP_L_01_01_2012.edition &&
    source.sourceType === "normative_document" &&
    source.jurisdiction === "MD" &&
    source.status === "active" &&
    source.officialStatus === "in_force" &&
    source.effectiveDate === CP_L_01_01_2012.effectiveDate &&
    source.validFrom === CP_L_01_01_2012.effectiveDate &&
    valuationDate >= CP_L_01_01_2012.effectiveDate &&
    (source.validTo === null || source.validTo >= valuationDate));
}

function validDecision(
  decision: TemporaryWorksApplicabilityDecision,
  source: TemporaryWorksNormativeSource,
  valuationDate: string,
) {
  return decision.organizationId === source.organizationId &&
    decision.sourceId === source.id &&
    decision.decision === "applicable" &&
    decision.officialStatus === "in_force" &&
    decision.sourceCode === CP_L_01_01_2012.code &&
    decision.sourceEdition === CP_L_01_01_2012.edition &&
    decision.applicableFrom !== null &&
    decision.applicableFrom <= valuationDate &&
    (decision.applicableUntil === null || decision.applicableUntil >= valuationDate);
}

export interface GeneralReserveView {
  source: TemporaryWorksNormativeSource | null;
  applicableDecision: TemporaryWorksApplicabilityDecision | null;
  savedDecision: GeneralReserveDecisionRecord | null;
  result: GeneralReserveResult | null;
  ready: boolean;
  error: string | null;
}

export interface GeneralReserveInput {
  category: GeneralReserveCategory;
  applicabilityDecisionId: string;
  basisNote: string;
}

export class ProfessionalGeneralReserveService {
  constructor(private readonly repository: ProfessionalGeneralReserveRepository) {}

  async getView(
    organizationId: string,
    generalEstimateId: string,
    valuationDate: string,
    adjustedTotals: ProfessionalGeneralEstimateTotals | null,
  ): Promise<GeneralReserveView> {
    const source = await this.repository.findSourceByIdentity(
      organizationId, CP_L_01_01_2012.code, CP_L_01_01_2012.edition,
    );
    const [savedDecision, history] = await Promise.all([
      this.repository.getDecision(organizationId, generalEstimateId),
      source
        ? this.repository.listApplicabilityDecisions(organizationId, source.id)
        : Promise.resolve([]),
    ]);
    // Revocation in a later governance revision invalidates a previously saved rate.
    const latest = [...history].sort((a, b) => b.revision - a.revision)[0] ?? null;
    const applicableDecision = eligibleSource(source, valuationDate) && latest &&
      validDecision(latest, source, valuationDate) ? latest : null;
    const base = { source, applicableDecision, savedDecision };
    const blocked = (message: string): GeneralReserveView =>
      ({ ...base, result: null, ready: false, error: message });

    if (!adjustedTotals) return blocked(
      "Rezerva poate fi calculată numai după completarea capitolelor 1–12, inclusiv lucrările provizorii și timpul friguros.",
    );
    if (!source) return blocked("Adăugați sursa CP L.01.01-2012 în Baza normativă.");
    if (!applicableDecision) return blocked(
      "CP L.01.01-2012 necesită o decizie actuală «Aplicabilă», valabilă pentru data devizului.",
    );
    if (!savedDecision) return blocked(
      "Selectați categoria investiției și înregistrați temeiul rezervei.",
    );
    if (savedDecision.sourceId !== source.id ||
      savedDecision.organizationId !== organizationId ||
      savedDecision.applicabilityDecisionId !== applicableDecision.id) {
      return blocked("Decizia rezervei nu mai corespunde aplicabilității normative curente.");
    }
    if (!(savedDecision.category in GENERAL_RESERVE_RATES)) {
      return blocked("Categoria rezervei nu mai este recunoscută.");
    }
    return { ...base, result: calculateGeneralReserve(adjustedTotals, savedDecision.category),
      ready: true, error: null };
  }

  async saveDecision(
    organizationId: string, generalEstimateId: string, input: GeneralReserveInput,
  ): Promise<GeneralReserveDecisionRecord> {
    const estimate = await this.repository.getGeneralEstimate(
      organizationId, generalEstimateId,
    );
    if (!estimate) fail("estimate_not_found", "Devizul general nu există.");
    if (!Object.prototype.hasOwnProperty.call(GENERAL_RESERVE_RATES, input.category)) {
      fail("invalid_category", "Selectați categoria investiției conform CP L.01.01-2012, pct. 6.11.");
    }
    const note = input.basisNote.trim();
    if (!note || note.length > 4000) {
      fail("invalid_basis", "Indicați temeiul încadrării în categoria investiției (maximum 4000 caractere).");
    }
    const source = await this.repository.findSourceByIdentity(
      organizationId, CP_L_01_01_2012.code, CP_L_01_01_2012.edition,
    );
    if (!eligibleSource(source, estimate.valuationDate)) {
      fail("invalid_source", "Sursa CP L.01.01-2012 nu este eligibilă la data devizului.");
    }
    const latest = (await this.repository.listApplicabilityDecisions(
      organizationId, source.id,
    )).sort((a, b) => b.revision - a.revision)[0];
    if (!latest || latest.id !== input.applicabilityDecisionId ||
      !validDecision(latest, source, estimate.valuationDate)) {
      fail("invalid_applicability", "Selectați cea mai recentă decizie «Aplicabilă», care acoperă data devizului.");
    }
    return this.repository.saveDecision(organizationId, generalEstimateId, {
      sourceId: source.id, applicabilityDecisionId: latest.id,
      category: input.category, basisNote: note,
    });
  }
}
