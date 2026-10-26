import assert from "node:assert/strict";
import {
  applyWinterConditionsToGeneralEstimate,
  calculateWinterConditions,
  calculateWinterConditionsBase,
  WinterConditionsCalculationError,
  winterPeriodCoefficient,
} from "../domain/professional-estimates/calculation/winter-conditions";
import {
  applyTemporaryWorksToGeneralEstimate,
  calculateProfessionalGeneralEstimate,
  calculateTemporaryWorks,
  calculateTemporaryWorksBase,
} from "../domain/professional-estimates/calculation";
import {
  NCM_L_02_06_2012_RULE_PACK,
} from "../domain/professional-estimates/official-rule-packs/ncm-l-02-06-2012";

const rows = NCM_L_02_06_2012_RULE_PACK;
assert.equal(rows.length, 58, "39 annex positions expand to 58 rate variants");
assert.equal(new Set(rows.map((row) => row.ruleCode)).size, 58);
for (let position = 1; position <= 39; position += 1) {
  assert.ok(
    rows.some((row) => Number(row.ruleCode.slice(0, 3)) === position),
    "missing annex position " + position,
  );
}
assert.equal(rows.some((row) => row.ruleCode === "019F"), false);
assert.equal(rows.find((row) => row.ruleCode === "019B")?.ratePercent, "2.4");
assert.equal(rows.find((row) => row.ruleCode === "020C")?.ratePercent, "1.0");
assert.equal(rows.find((row) => row.ruleCode === "020D")?.ratePercent, "0.5");
assert.equal(rows.find((row) => row.ruleCode === "024")?.ratePercent, "0.8");
assert.equal(rows.find((row) => row.ruleCode === "025")?.ratePercent, "0.5");
assert.equal(rows.find((row) => row.ruleCode === "032")?.ratePercent, "2.5");
assert.equal(rows.find((row) => row.ruleCode === "038")?.ratePercent, "0.2");

for (const code of ["013", "018A", "026B", "030", "033", "036", "039"]) {
  assert.equal(rows.find((row) => row.ruleCode === code)?.principalWorkOnly, true);
}
for (const code of ["012", "022", "023", "024", "029", "034", "035"]) {
  assert.equal(rows.find((row) => row.ruleCode === code)?.principalWorkOnly, false);
}
assert.ok(rows.every((row) => row.sourceReference.includes("Anexa A, poz.")));

const original = calculateProfessionalGeneralEstimate([
  {
    objectEstimateId: "10000000-0000-4000-8000-000000000001",
    chapterNumber: 2,
    constructionWorks: "5051.2539",
    installationWorks: "0",
    equipmentFurnitureInventory: "0",
    otherCosts: "0",
    currency: "MDL",
  },
  {
    objectEstimateId: "10000000-0000-4000-8000-000000000002",
    chapterNumber: 9,
    constructionWorks: "200",
    installationWorks: "0",
    equipmentFurnitureInventory: "100",
    otherCosts: "20",
    currency: "MDL",
  },
]);

const tempBase = calculateTemporaryWorksBase(original);
assert.equal(tempBase.combined, "5051.2539");
const temp = calculateTemporaryWorks({
  baseConstruction: tempBase.construction,
  baseInstallation: tempBase.installation,
  ratePercent: "0.8",
  projectCondition: "standard",
});
const afterTemporary = applyTemporaryWorksToGeneralEstimate(original, temp);
assert.equal(afterTemporary.chapters[8].constructionWorks, "40.4100312");

const base = calculateWinterConditionsBase(afterTemporary);
assert.deepEqual(base, {
  construction: "5091.6639312",
  installation: "0",
  combined: "5091.6639312",
});
assert.equal(winterPeriodCoefficient({ kind: "annual_average" }), "1");

const rate = rows.find((row) => row.ruleCode === "024");
assert.ok(rate);
const annual = calculateWinterConditions({
  baseConstruction: base.construction,
  baseInstallation: base.installation,
  ratePercent: rate.ratePercent,
  period: { kind: "annual_average" },
});
assert.equal(annual.coefficient, "1");
assert.equal(annual.winterTotal, "40.7333114496");

const beforeSnapshot = JSON.stringify(afterTemporary);
const afterWinter = applyWinterConditionsToGeneralEstimate(afterTemporary, annual);
assert.equal(afterWinter.chapters[8].constructionWorks, "40.4100312");
assert.equal(afterWinter.chapters[9].constructionWorks, "240.7333114496");
assert.equal(afterWinter.chapters[9].equipmentFurnitureInventory, "100");
assert.equal(afterWinter.chapters[9].otherCosts, "20");
assert.equal(afterWinter.totals.total, "5452.3972426496");
assert.equal(JSON.stringify(afterTemporary), beforeSnapshot, "pure calculation must not mutate inputs");

const short = { kind: "short_project" as const, durationDays: "100",
  winterDays: "23", projectReference: "POC-2026-01" };
assert.equal(winterPeriodCoefficient(short), "1");
const doubled = calculateWinterConditions({
  baseConstruction: base.construction,
  baseInstallation: base.installation,
  ratePercent: rate.ratePercent,
  period: { ...short, winterDays: "46" },
});
assert.equal(doubled.coefficient, "2");
assert.equal(doubled.winterTotal, "81.4666228992");

const noColdDays = calculateWinterConditions({
  baseConstruction: "1000",
  baseInstallation: "250",
  ratePercent: "0.8",
  period: { ...short, winterDays: "0" },
});
assert.equal(noColdDays.winterTotal, "0");

const split = calculateWinterConditions({
  baseConstruction: "1000",
  baseInstallation: "250",
  ratePercent: "0.8",
  period: { kind: "annual_average" },
});
assert.equal(split.winterConstruction, "8");
assert.equal(split.winterInstallation, "2");
assert.equal(split.winterTotal, "10");

for (const invalidPeriod of [
  { ...short, durationDays: "0" },
  { ...short, durationDays: "-1" },
  { ...short, durationDays: "1.5" },
  { ...short, winterDays: "101" },
  { ...short, winterDays: "-1" },
  { ...short, winterDays: "NaN" },
  { ...short, projectReference: "   " },
]) {
  assert.throws(
    () => winterPeriodCoefficient(invalidPeriod),
    WinterConditionsCalculationError,
  );
}
assert.throws(
  () => calculateWinterConditions({
    baseConstruction: "-1", baseInstallation: "0", ratePercent: "0.8",
    period: { kind: "annual_average" },
  }),
  WinterConditionsCalculationError,
);
assert.throws(
  () => calculateWinterConditions({
    baseConstruction: "1", baseInstallation: "0", ratePercent: "0",
    period: { kind: "annual_average" },
  }),
  WinterConditionsCalculationError,
);
assert.throws(
  () => applyWinterConditionsToGeneralEstimate(original, annual),
  /stale/,
  "the calculated base may not be reused after source totals change",
);

console.log("M8.5C2A winter-conditions domain regression: OK");
