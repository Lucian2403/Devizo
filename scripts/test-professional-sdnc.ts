import assert from "node:assert/strict";
import {
  calculateSdnc2026, SdncCalculationError,
} from "../domain/professional-estimates/calculation";
import {
  ProfessionalSdncError, ProfessionalSdncService, SDNC_2026_LEGAL,
  type SdncInput,
} from "../domain/professional-estimates/professional-sdnc.service";
import type {
  SdncDecisionRecord, ProfessionalSdncRepository, SaveSdncDecisionInput,
} from "../domain/professional-estimates/professional-sdnc.repository";

const sample = calculateSdnc2026("1000000", 2026);
assert.equal(sample.annualContributionMdl, "5000");
assert.equal(sample.ratePercent, "0.5");
assert.equal(sample.annualEligibleInvestmentMdl, "1000000");
assert.equal(calculateSdnc2026("5176.2539", 2026).annualContributionMdl, "25.8812695");
assert.equal(calculateSdnc2026("1,2345", 2026).annualContributionMdl, "0.0061725");
assert.equal(calculateSdnc2026("0", 2026).annualContributionMdl, "0");
for (const bad of ["", "-1", "1.12345", "1,1,1", "Infinity", "NaN", "0x20", "1e5"]) {
  assert.throws(() => calculateSdnc2026(bad, 2026), SdncCalculationError, bad);
}
assert.throws(() => calculateSdnc2026("1000", 2027), SdncCalculationError);
assert.throws(() => calculateSdnc2026("99999999999999999", 2026), SdncCalculationError);

const ORG = "10000000-0000-4000-8000-000000000001";
const ESTIMATE = "20000000-0000-4000-8000-000000000001";
class MemoryRepository implements ProfessionalSdncRepository {
  record: SdncDecisionRecord | null = null;
  async getGeneralEstimate(org: string, id: string) {
    if (org !== ORG || id !== ESTIMATE) return null;
    return { id, organizationId: org, valuationDate: "2026-10-15", currency: "MDL" };
  }
  async getDecision(org: string, id: string) {
    return this.record?.organizationId === org && this.record.generalEstimateId === id
      ? this.record : null;
  }
  async saveDecision(org: string, id: string, input: SaveSdncDecisionInput) {
    const record: SdncDecisionRecord = {
      id: this.record?.id ?? "30000000-0000-4000-8000-000000000001",
      organizationId: org, generalEstimateId: id, ...input,
      updatedAt: new Date("2026-11-10T10:00:00Z"),
    };
    this.record = record;
    return record;
  }
}
const liable: SdncInput = {
  fiscalYear: "2026",
  mode: "liable",
  workKind: "new_construction",
  permitConfirmed: true,
  nonPublicFundingConfirmed: true,
  notExemptHouseConfirmed: true,
  annualEligibleInvestmentMdl: "1000000",
  supportingDocument: "Situația investițiilor 2026, fila 1",
  exclusionReason: "",
  basisNote: "Autorizație nr. 15, finanțare proprie",
};
const excluded: SdncInput = {
  ...liable, mode: "not_liable", exclusionReason: "public_budget",
  annualEligibleInvestmentMdl: "", supportingDocument: "",
  workKind: "", permitConfirmed: false,
  nonPublicFundingConfirmed: false, notExemptHouseConfirmed: false,
};

async function main() {
  const repo = new MemoryRepository();
  const service = new ProfessionalSdncService(repo);
  assert.equal((await service.getView(ORG, ESTIMATE, "2026-10-15", true)).ready, false);
  await assert.rejects(service.saveDecision("other", ESTIMATE, liable), ProfessionalSdncError);
  await assert.rejects(service.saveDecision(ORG, ESTIMATE, {
    ...liable, fiscalYear: "2027",
  }), ProfessionalSdncError);
  for (const invalid of [
    { ...liable, mode: "unknown" },
    { ...liable, workKind: "" },
    { ...liable, permitConfirmed: false },
    { ...liable, nonPublicFundingConfirmed: false },
    { ...liable, notExemptHouseConfirmed: false },
    { ...liable, supportingDocument: " " },
    { ...liable, basisNote: "" },
  ]) {
    await assert.rejects(service.saveDecision(ORG, ESTIMATE, invalid),
      ProfessionalSdncError, JSON.stringify(invalid));
  }
  await assert.rejects(service.saveDecision(ORG, ESTIMATE, {
    ...liable, annualEligibleInvestmentMdl: "-100",
  }), SdncCalculationError);

  await service.saveDecision(ORG, ESTIMATE, liable);
  const saved = repo.record!;
  assert.equal(saved.annualEligibleInvestmentMdl, "1000000");
  assert.equal(saved.legalVersion, SDNC_2026_LEGAL.version);
  let view = await service.getView(ORG, ESTIMATE, "2026-10-15", true);
  assert.equal(view.ready, true);
  assert.equal(view.result?.annualContributionMdl, "5000");
  assert.equal((await service.getView(ORG, ESTIMATE, "2026-10-15", false)).ready, false);
  assert.equal((await service.getView(ORG, ESTIMATE, "2027-01-01", true)).ready, false);
  assert.equal((await service.getView("other", ESTIMATE, "2026-10-15", true)).ready, false);
  repo.record!.legalVersion = "older-law";
  assert.equal((await service.getView(ORG, ESTIMATE, "2026-10-15", true)).ready, false);
  repo.record!.legalVersion = SDNC_2026_LEGAL.version;

  await assert.rejects(service.saveDecision(ORG, ESTIMATE, {
    ...excluded, exclusionReason: "not_confirmed",
  }), ProfessionalSdncError);
  await service.saveDecision(ORG, ESTIMATE, excluded);
  view = await service.getView(ORG, ESTIMATE, "2026-10-15", true);
  assert.equal(view.ready, true);
  assert.equal(view.excluded, true);
  assert.equal(view.result, null);
  assert.equal(repo.record?.annualEligibleInvestmentMdl, null);
  assert.equal(repo.record?.supportingDocument, null);
  console.log("M8.5D2 SDNC annual 2026, eligibility, provenance and isolation: OK");
}
void main();
