import assert from "node:assert/strict";
import {
  calculateProfessionalGeneralEstimate,
  calculateGeneralReserve, GeneralReserveCalculationError,
} from "../domain/professional-estimates/calculation";
import {
  ProfessionalGeneralReserveService, ProfessionalGeneralReserveError,
} from "../domain/professional-estimates/professional-general-reserve.service";
import type {
  GeneralReserveDecisionRecord, ProfessionalGeneralReserveRepository,
} from "../domain/professional-estimates/professional-general-reserve.repository";
import type {
  TemporaryWorksApplicabilityDecision, TemporaryWorksNormativeSource,
} from "../domain/professional-estimates/professional-temporary-works.repository";

const ids = {
  org: "10000000-0000-4000-8000-000000000001",
  otherOrg: "10000000-0000-4000-8000-000000000002",
  estimate: "20000000-0000-4000-8000-000000000001",
  source: "30000000-0000-4000-8000-000000000001",
  applicability: "40000000-0000-4000-8000-000000000001",
  rev2: "40000000-0000-4000-8000-000000000002",
};
const original = calculateProfessionalGeneralEstimate([
  { objectEstimateId: ids.estimate, chapterNumber: 2,
    constructionWorks: "5051.2539", installationWorks: "0",
    equipmentFurnitureInventory: "0", otherCosts: "0", currency: "MDL" },
  { objectEstimateId: "20000000-0000-4000-8000-000000000002", chapterNumber: 9,
    constructionWorks: "200", installationWorks: "0",
    equipmentFurnitureInventory: "100", otherCosts: "20", currency: "MDL" },
]);
const before = JSON.stringify(original);
const social = calculateGeneralReserve(original, "social");
assert.equal(social.ratePercent, "2");
assert.equal(social.reserve.constructionWorks, "105.025078");
assert.equal(social.reserve.equipmentFurnitureInventory, "2");
assert.equal(social.reserve.otherCosts, "0.4");
assert.equal(social.reserve.total, "107.425078");
assert.equal(social.withReserve.total, "5478.678978");
assert.equal(JSON.stringify(original), before);
assert.equal(original.chapters[9].constructionWorks, "200",
  "Reserve must NOT be written to Chapter 9");
assert.equal(calculateGeneralReserve(original, "production").reserve.total, "161.137617");
assert.equal(calculateGeneralReserve(original, "feasibility").reserve.total, "322.275234");
assert.throws(
  () => calculateGeneralReserve(original, "invalid" as "social"),
  GeneralReserveCalculationError,
);
assert.throws(
  () => calculateGeneralReserve({
    ...original, totals: { ...original.totals, total: "1" },
  }, "social"), GeneralReserveCalculationError,
);
assert.throws(
  () => calculateGeneralReserve({
    ...original, totals: { ...original.totals, otherCosts: "-1" },
  }, "social"), GeneralReserveCalculationError,
);

const source: TemporaryWorksNormativeSource = {
  id: ids.source, organizationId: ids.org, code: "CP L.01.01-2012",
  edition: "2012", title: "Instrucțiuni întocmire devize",
  sourceType: "normative_document", jurisdiction: "MD", status: "active",
  officialStatus: "in_force", effectiveDate: "2013-02-15",
  validFrom: "2013-02-15", validTo: null,
  sourceUri: "https://ednc.gov.md/cp-l-01-01-2012/",
};
const applicable: TemporaryWorksApplicabilityDecision = {
  id: ids.applicability, organizationId: ids.org, sourceId: ids.source,
  revision: 1, decision: "applicable", applicableFrom: "2013-02-15",
  applicableUntil: null, officialStatus: "in_force",
  sourceCode: source.code, sourceEdition: source.edition, basisNote: "Test",
};
class FakeRepository implements ProfessionalGeneralReserveRepository {
  source: TemporaryWorksNormativeSource | null = { ...source };
  decisions: TemporaryWorksApplicabilityDecision[] = [{ ...applicable }];
  saved: GeneralReserveDecisionRecord | null = null;
  async getGeneralEstimate(org: string, id: string) {
    return org === ids.org && id === ids.estimate
      ? { id, organizationId: org, valuationDate: "2026-10-15", currency: "MDL" } : null;
  }
  async findSourceByIdentity(org: string, code: string, edition: string) {
    const src = this.source;
    return src?.organizationId === org && src.code === code && src.edition === edition
      ? src : null;
  }
  async getSource(org: string, sourceId: string) {
    return this.source?.organizationId === org && this.source?.id === sourceId
      ? this.source : null;
  }
  async listApplicabilityDecisions(org: string, sourceId: string) {
    return this.decisions.filter(d => d.organizationId === org && d.sourceId === sourceId);
  }
  async getApplicabilityDecision(org: string, sourceId: string, id: string) {
    return this.decisions.find(d =>
      d.organizationId === org && d.sourceId === sourceId && d.id === id) ?? null;
  }
  async getDecision(org: string, id: string) {
    return this.saved?.organizationId === org && this.saved.generalEstimateId === id
      ? this.saved : null;
  }
  async saveDecision(
    org: string, id: string,
    input: Pick<GeneralReserveDecisionRecord,
      "sourceId" | "applicabilityDecisionId" | "category" | "basisNote">,
  ) {
    const saved: GeneralReserveDecisionRecord = {
      id: this.saved?.id ?? "50000000-0000-4000-8000-000000000001",
      organizationId: org, generalEstimateId: id, ...input,
      updatedAt: new Date("2026-10-28T00:00:00Z"),
    };
    this.saved = saved;
    return saved;
  }
}

async function main() {
  const repo = new FakeRepository();
  const service = new ProfessionalGeneralReserveService(repo);
  assert.equal((await service.getView(ids.org, ids.estimate, "2026-10-15", original)).ready, false);
  await assert.rejects(
    service.saveDecision(ids.otherOrg, ids.estimate, {
      category: "social", applicabilityDecisionId: ids.applicability, basisNote: "test",
    }), ProfessionalGeneralReserveError,
  );
  await assert.rejects(
    service.saveDecision(ids.org, ids.estimate, {
      category: "invalid" as "social", applicabilityDecisionId: ids.applicability,
      basisNote: "test",
    }), ProfessionalGeneralReserveError,
  );
  await assert.rejects(
    service.saveDecision(ids.org, ids.estimate, {
      category: "social", applicabilityDecisionId: ids.applicability, basisNote: "  ",
    }), ProfessionalGeneralReserveError,
  );
  await service.saveDecision(ids.org, ids.estimate, {
    category: "social", applicabilityDecisionId: ids.applicability,
    basisNote: "Clădire socială, document proiect", 
  });
  let view = await service.getView(ids.org, ids.estimate, "2026-10-15", original);
  assert.equal(view.ready, true);
  assert.equal(view.result?.reserve.total, "107.425078");
  assert.equal(view.savedDecision?.basisNote, "Clădire socială, document proiect");
  assert.equal((await service.getView(ids.org, ids.estimate, "2026-10-15", null)).ready, false);
  repo.decisions.push({ ...applicable, id: ids.rev2, revision: 2, decision: "not_applicable" });
  view = await service.getView(ids.org, ids.estimate, "2026-10-15", original);
  assert.equal(view.ready, false);
  assert.equal(view.result, null);
  await assert.rejects(
    service.saveDecision(ids.org, ids.estimate, {
      category: "production", applicabilityDecisionId: ids.applicability,
      basisNote: "Uzina test",
    }), ProfessionalGeneralReserveError,
  );
  repo.decisions[1]!.decision = "applicable";
  view = await service.getView(ids.org, ids.estimate, "2026-10-15", original);
  assert.equal(view.ready, false, "A fresh source decision makes the saved choice stale");
  await service.saveDecision(ids.org, ids.estimate, {
    category: "production", applicabilityDecisionId: ids.rev2,
    basisNote: "Uzina test",
  });
  assert.equal((await service.getView(ids.org, ids.estimate, "2026-10-15", original))
    .result?.ratePercent, "3");
  repo.source!.officialStatus = "unknown";
  assert.equal((await service.getView(ids.org, ids.estimate, "2026-10-15", original)).ready, false);
  console.log("M8.5D1 unforeseen reserve, governance and post-chapter arithmetic: OK");
}
void main();
