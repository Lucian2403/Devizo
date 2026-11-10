import {
  calculateSdnc2026,
  SDNC_FISCAL_YEAR,
  SdncCalculationError,
  type SdncCalculationResult,
} from "./calculation";
import type {
  ProfessionalSdncRepository,
  SaveSdncDecisionInput,
  SdncDecisionRecord,
  SdncExclusionReason,
  SdncWorkKind,
} from "./professional-sdnc.repository";

/** SFS BGPF, amended by Law 153/2026, applicable for fiscal year 2026. */
export const SDNC_2026_LEGAL = {
  version: "MD-SDNC-2026-L153-SFS432",
  fiscalYear: SDNC_FISCAL_YEAR,
  legalBasis: "Codul urbanismului și construcțiilor nr. 434/2023, art. 347; Legea nr. 329/2025; Legea nr. 153/2026",
  rateSource: "https://www.sfs.md/ro/intrebare-baza-de-date-generalizare/488",
  baseSource: "https://www.sfs.md/ro/intrebare-baza-de-date-generalizare/487",
  eligibilitySource: "https://www.sfs.md/ro/intrebare-baza-de-date-generalizare/486",
} as const;

export class ProfessionalSdncError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ProfessionalSdncError";
  }
}

function fail(code: string, message: string): never {
  throw new ProfessionalSdncError(code, message);
}

function validateDocument(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 4000) {
    fail("missing_evidence", `Completați ${field} (maximum 4000 caractere).`);
  }
  return normalized;
}

export interface SdncInput {
  fiscalYear: string;
  mode: string;
  workKind: string;
  permitConfirmed: boolean;
  nonPublicFundingConfirmed: boolean;
  notExemptHouseConfirmed: boolean;
  annualEligibleInvestmentMdl: string;
  supportingDocument: string;
  exclusionReason: string;
  basisNote: string;
}

export interface SdncView {
  savedDecision: SdncDecisionRecord | null;
  result: SdncCalculationResult | null;
  excluded: boolean;
  ready: boolean;
  error: string | null;
}

const allowedKinds: SdncWorkKind[] = ["new_construction", "existing_intervention"];
const exclusionReasons: SdncExclusionReason[] = [
  "public_budget", "no_building_permit",
  "personal_individual_house", "outside_eligible_works",
];

export class ProfessionalSdncService {
  constructor(private readonly repository: ProfessionalSdncRepository) {}

  async getView(
    org: string,
    generalEstimateId: string,
    valuationDate: string,
    reserveReady: boolean,
  ): Promise<SdncView> {
    const savedDecision = await this.repository.getDecision(org, generalEstimateId);
    const blocked = (error: string): SdncView =>
      ({ savedDecision, result: null, excluded: false, ready: false, error });
    if (!/^2026-\d{2}-\d{2}$/.test(valuationDate)) {
      return blocked("Acest modul folosește legislația pentru anul fiscal 2026. Pentru alte perioade este necesară validarea regimului legal.");
    }
    if (!reserveReady) {
      return blocked("Finalizați mai întâi calculul și decizia rezervei pentru capitolele 1–12.");
    }
    if (!savedDecision) return blocked("Nu există încă o decizie explicită privind SDNC.");
    if (savedDecision.organizationId !== org ||
      savedDecision.legalVersion !== SDNC_2026_LEGAL.version ||
      savedDecision.fiscalYear !== SDNC_FISCAL_YEAR) {
      return blocked("Decizia SDNC provine dintr-un regim legal diferit. Este necesară revalidarea.");
    }
    if (savedDecision.mode === "not_liable") {
      if (!savedDecision.exclusionReason ||
        !exclusionReasons.includes(savedDecision.exclusionReason)) {
        return blocked("Motivul neaplicabilității nu este valabil.");
      }
      return { savedDecision, result: null, excluded: true, ready: true, error: null };
    }
    if (savedDecision.mode !== "liable" ||
      !savedDecision.workKind || !allowedKinds.includes(savedDecision.workKind) ||
      !savedDecision.permitConfirmed || !savedDecision.nonPublicFundingConfirmed ||
      !savedDecision.notExemptHouseConfirmed ||
      savedDecision.annualEligibleInvestmentMdl === null ||
      !savedDecision.supportingDocument) {
      return blocked("Confirmările legale sau baza anuală documentată lipsesc.");
    }
    try {
      return {
        savedDecision,
        result: calculateSdnc2026(savedDecision.annualEligibleInvestmentMdl, savedDecision.fiscalYear),
        excluded: false, ready: true, error: null,
      };
    } catch (error) {
      if (error instanceof SdncCalculationError) return blocked(error.message);
      throw error;
    }
  }

  async saveDecision(
    org: string, generalEstimateId: string, input: SdncInput,
  ): Promise<SdncDecisionRecord> {
    const estimate = await this.repository.getGeneralEstimate(org, generalEstimateId);
    if (!estimate) fail("estimate_not_found", "Devizul General nu există.");
    if (estimate.valuationDate.slice(0, 4) !== "2026" || input.fiscalYear !== "2026") {
      fail("unsupported_period", "Acest modul poate salva doar decizii pentru anul fiscal 2026 și devize evaluate în 2026.");
    }
    const basisNote = validateDocument(input.basisNote, "temeiul deciziei");
    let decision: SaveSdncDecisionInput;
    if (input.mode === "not_liable") {
      if (!exclusionReasons.includes(input.exclusionReason as SdncExclusionReason)) {
        fail("invalid_exclusion", "Selectați motivul legal pentru care contribuția nu se aplică.");
      }
      decision = {
        fiscalYear: 2026, legalVersion: SDNC_2026_LEGAL.version,
        mode: "not_liable", workKind: null,
        permitConfirmed: false, nonPublicFundingConfirmed: false,
        notExemptHouseConfirmed: false,
        annualEligibleInvestmentMdl: null, supportingDocument: null,
        exclusionReason: input.exclusionReason as SdncExclusionReason, basisNote,
      };
    } else if (input.mode === "liable") {
      if (!allowedKinds.includes(input.workKind as SdncWorkKind) ||
        !input.permitConfirmed || !input.nonPublicFundingConfirmed ||
        !input.notExemptHouseConfirmed) {
        fail("eligibility_unconfirmed", "Confirmați tipul lucrării, autorizația, finanțarea și lipsa excepției pentru casa individuală.");
      }
      const amount = calculateSdnc2026(input.annualEligibleInvestmentMdl, 2026);
      decision = {
        fiscalYear: 2026, legalVersion: SDNC_2026_LEGAL.version,
        mode: "liable", workKind: input.workKind as SdncWorkKind,
        permitConfirmed: true, nonPublicFundingConfirmed: true,
        notExemptHouseConfirmed: true,
        annualEligibleInvestmentMdl: amount.annualEligibleInvestmentMdl,
        supportingDocument: validateDocument(input.supportingDocument, "documentul care dovedește baza anuală"),
        exclusionReason: null, basisNote,
      };
    } else {
      fail("mode_required", "Selectați explicit dacă SDNC se aplică.");
    }
    return this.repository.saveDecision(org, generalEstimateId, decision);
  }
}
