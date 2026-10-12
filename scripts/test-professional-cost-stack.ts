import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  calculateProfessionalCostStack,
  CostStackValidationError,
  type ProfessionalCostStackInput,
  type ResolvedCostRuleReference,
} from "../domain/professional-estimates/calculation";
import type { ResourceTypeTotals } from "../domain/professional-estimates/calculation";

const zeroResourceTotals: ResourceTypeTotals = {
  labor: "0",
  material: "0",
  machinery: "0",
  transport: "0",
  energy: "0",
  other: "0",
};

const noRule = { status: "not_applicable", reason: "Not applicable in this test." } as const;
const rule: ResolvedCostRuleReference = {
  ruleType: "resolved_test_rule",
  calculationRuleId: "rule-17",
  sourceId: "source-4",
  sourceReference: "CP test paragraph",
};

function baseInput(
  overrides: Partial<ProfessionalCostStackInput> = {},
): ProfessionalCostStackInput {
  return {
    currency: "MDL",
    resourceTotals: zeroResourceTotals,
    laborContributions: noRule,
    materialTransport: noRule,
    procurementStorage: noRule,
    overhead: noRule,
    estimatedProfit: noRule,
    ...overrides,
  };
}

function expectCostStackError(
  code: CostStackValidationError["code"],
  run: () => unknown,
): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof CostStackValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

// Historical example fixture: tests order and precision only; these rates are
// deliberately passed as data and are not calculator defaults.
{
  const result = calculateProfessionalCostStack(
    baseInput({
      resourceTotals: {
        labor: "2049.43",
        material: "6304.37",
        machinery: "541.98",
        transport: "0",
        energy: "0",
        other: "0",
      },
      laborContributions: {
        status: "applied",
        ratePercent: "26.5",
        rule: { ...rule, ruleType: "labor_contributions" },
      },
      materialTransport: {
        status: "applied",
        method: "percentage_of_material",
        ratePercent: "7",
        rule: { ...rule, ruleType: "material_transport" },
      },
      procurementStorage: {
        status: "applied",
        ratePercent: "2",
        rule: { ...rule, ruleType: "procurement_storage" },
      },
      overhead: {
        status: "applied",
        basis: "direct_cost",
        ratePercent: "14.5",
        rule: { ...rule, ruleType: "overhead" },
      },
      estimatedProfit: {
        status: "applied",
        ratePercent: "6",
        rule: { ...rule, ruleType: "estimated_profit" },
      },
    }),
  );

  assert.equal(result.currency, "MDL");
  assert.equal(result.laborCost, "2049.43");
  assert.equal(result.materialCost, "6304.37");
  assert.equal(result.machineryCost, "541.98");
  assert.equal(result.transportResourceCost, "0");
  assert.equal(result.energyCost, "0");
  assert.equal(result.otherCost, "0");
  assert.equal(result.rawResourceTotal, "8895.78");
  assert.equal(result.laborContributions, "543.09895");
  assert.equal(result.materialTransport, "441.3059");
  assert.equal(result.procurementStorage, "126.0874");
  assert.equal(result.directCost, "10006.27225");
  assert.equal(
    new Decimal(result.directCost)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toFixed(2),
    "10006.27",
  );

  const exactDirectCost = new Decimal("10006.27225");
  const exactOverhead = exactDirectCost.times("14.5").dividedBy(100);
  const exactBeforeProfit = exactDirectCost.plus(exactOverhead);
  const exactProfit = exactBeforeProfit.times(6).dividedBy(100);
  assert.equal(result.overhead, exactOverhead.toString());
  assert.equal(result.estimateCostBeforeProfit, exactBeforeProfit.toString());
  assert.equal(result.estimatedProfit, exactProfit.toString());
  assert.equal(
    result.estimateSubtotalBeforeLimitedCostsAndVat,
    exactBeforeProfit.plus(exactProfit).toString(),
  );
  assert.notEqual(result.directCost, "10006.28");
  assert.equal(result.appliedRules.length, 5);
  assert.deepEqual(
    result.appliedRules.map((application) => application.component),
    [
      "labor_contributions",
      "material_transport",
      "procurement_storage",
      "overhead",
      "estimated_profit",
    ],
  );
  assert.equal(result.appliedRules[0]?.basis, "labor_cost");
  assert.equal(result.appliedRules[0]?.ratePercent, "26.5");
  assert.equal(result.appliedRules[0]?.amount, "543.09895");
  assert.equal(result.appliedRules[0]?.calculationRuleId, "rule-17");
  assert.equal(result.appliedRules[0]?.sourceId, "source-4");
  assert.equal(result.appliedRules[0]?.sourceReference, "CP test paragraph");
  assert.equal(result.appliedRules[4]?.basis, "estimate_cost_before_profit");
}

// Overhead bases are explicit; labor-based overhead uses labor only.
{
  const result = calculateProfessionalCostStack(
    baseInput({
      resourceTotals: {
        ...zeroResourceTotals,
        labor: "100",
        material: "100",
      },
      overhead: {
        status: "applied",
        basis: "labor_cost",
        ratePercent: "10",
        rule,
      },
    }),
  );
  assert.equal(result.directCost, "200");
  assert.equal(result.overhead, "10");
  assert.equal(result.appliedRules[0]?.basis, "labor_cost");
}

// Procurement/storage is based on material only, excluding both kinds of
// transport and its own amount.
{
  const result = calculateProfessionalCostStack(
    baseInput({
      resourceTotals: {
        ...zeroResourceTotals,
        material: "100",
        transport: "20",
      },
      materialTransport: {
        status: "applied",
        method: "percentage_of_material",
        ratePercent: "10",
        rule,
      },
      procurementStorage: {
        status: "applied",
        ratePercent: "5",
        rule,
      },
    }),
  );
  assert.equal(result.materialTransport, "10");
  assert.equal(result.procurementStorage, "5");
  assert.equal(result.rawResourceTotal, "120");
  assert.equal(result.directCost, "135");
  assert.equal(result.appliedRules[1]?.basis, "material_cost");
}

// Fixed delivery transport is a single resolved amount in the calculation
// currency, distinct from a transport resource already in the raw totals.
{
  const result = calculateProfessionalCostStack(
    baseInput({
      resourceTotals: { ...zeroResourceTotals, transport: "12" },
      materialTransport: {
        status: "applied",
        method: "fixed_amount",
        amount: "8.75",
        currency: "MDL",
        rule,
      },
    }),
  );
  assert.equal(result.transportResourceCost, "12");
  assert.equal(result.materialTransport, "8.75");
  assert.equal(result.directCost, "20.75");
  assert.equal(result.appliedRules[0]?.basis, "fixed_amount");
  assert.equal(result.appliedRules[0]?.value, "8.75");
  assert.equal(result.appliedRules[0]?.ratePercent, null);
}

// Explicit not-applicable decisions deterministically produce zero components
// and preserve their explanations in the result.
{
  const result = calculateProfessionalCostStack(
    baseInput({
      resourceTotals: { ...zeroResourceTotals, material: "100" },
      laborContributions: {
        status: "not_applicable",
        reason: "No labor resource is present.",
      },
    }),
  );
  assert.equal(result.laborContributions, "0");
  assert.equal(result.materialTransport, "0");
  assert.equal(result.procurementStorage, "0");
  assert.equal(result.overhead, "0");
  assert.equal(result.estimatedProfit, "0");
  assert.equal(result.appliedRules.length, 0);
  assert.deepEqual(result.decisions.labor_contributions, {
    status: "not_applicable",
    reason: "No labor resource is present.",
  });
  assert.equal(result.decisions.overhead.status, "not_applicable");
}

// Missing or malformed decisions fail instead of silently becoming zero.
{
  const input = baseInput();
  const withoutLaborDecision = { ...input } as Partial<ProfessionalCostStackInput>;
  delete withoutLaborDecision.laborContributions;
  expectCostStackError("missing_decision", () =>
    calculateProfessionalCostStack(withoutLaborDecision as ProfessionalCostStackInput),
  );

  expectCostStackError("invalid_decision", () =>
    calculateProfessionalCostStack(
      baseInput({
        overhead: { status: "unknown" } as never,
      }),
    ),
  );
  expectCostStackError("missing_reason", () =>
    calculateProfessionalCostStack({
      ...input,
      estimatedProfit: { status: "not_applicable", reason: " " },
    }),
  );
}

// Invalid rates, amounts, currencies, and unsupported transport modes fail.
{
  expectCostStackError("negative_rate", () =>
    calculateProfessionalCostStack(
      baseInput({
        laborContributions: {
          status: "applied",
          ratePercent: "-0.1",
          rule,
        },
      }),
    ),
  );
  expectCostStackError("invalid_decimal", () =>
    calculateProfessionalCostStack(
      baseInput({
        overhead: {
          status: "applied",
          basis: "direct_cost",
          ratePercent: "not-a-number",
          rule,
        },
      }),
    ),
  );
  expectCostStackError("negative_amount", () =>
    calculateProfessionalCostStack(
      baseInput({
        materialTransport: {
          status: "applied",
          method: "fixed_amount",
          amount: "-1",
          currency: "MDL",
          rule,
        },
      }),
    ),
  );
  expectCostStackError("currency_mismatch", () =>
    calculateProfessionalCostStack(
      baseInput({
        materialTransport: {
          status: "applied",
          method: "fixed_amount",
          amount: "1",
          currency: "EUR",
          rule,
        },
      }),
    ),
  );
  expectCostStackError("unsupported_transport_method", () =>
    calculateProfessionalCostStack(
      baseInput({
        materialTransport: {
          status: "applied",
          method: "unsupported",
          requestedMethod: "tonne-km",
          rule,
        },
      }),
    ),
  );
  expectCostStackError("invalid_overhead_basis", () =>
    calculateProfessionalCostStack(
      baseInput({
        overhead: {
          status: "applied",
          basis: "machinery_cost",
          ratePercent: "10",
          rule,
        } as never,
      }),
    ),
  );
  expectCostStackError("invalid_currency", () =>
    calculateProfessionalCostStack(baseInput({ currency: " " })),
  );
}

// Decimal-only arithmetic: float-unsafe raw values stay exact in aggregation.
{
  const result = calculateProfessionalCostStack(
    baseInput({
      resourceTotals: {
        ...zeroResourceTotals,
        labor: "0.1",
        material: "0.2",
      },
      procurementStorage: {
        status: "applied",
        ratePercent: "10",
        rule,
      },
    }),
  );
  assert.equal(result.procurementStorage, "0.02");
  assert.equal(result.rawResourceTotal, "0.3");
  assert.equal(result.directCost, "0.32");
}

console.log("Professional cost stack checks passed.");
