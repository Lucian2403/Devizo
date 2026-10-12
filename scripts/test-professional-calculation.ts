import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  calculateResourceLine,
  calculateResources,
  isPriceDateEligible,
  PriceCandidateConsistencyError,
  ResourceCalculationError,
  selectEligibleResourcePrice,
  type ResourceCalculationInput,
  type ResourcePriceCandidate,
} from "../domain/professional-estimates/calculation";

/**
 * M8.3A deterministic resource calculation kernel tests.
 *
 * These exercise only the pure kernel: the resource-method formula, decimal
 * precision, validation rules, aggregation and date-based price eligibility.
 * No database, UI, VAT, overhead, profit or transport behaviour is involved.
 */

function baseLine(
  overrides: Partial<ResourceCalculationInput> = {},
): ResourceCalculationInput {
  return {
    estimateNormVersionId: "env-1",
    resourceConsumptionId: "rc-1",
    resourceId: "res-1",
    resourcePriceId: "rp-1",
    normApplicationId: "na-1",
    resourceType: "material",
    currency: "MDL",
    workQuantity: "250",
    normBasisQuantity: "100",
    normativeConsumption: "3",
    applicationCoefficient: "1.1",
    resourcePrice: "1200",
    priceBasisQuantity: "1000",
    ...overrides,
  };
}

function candidate(
  overrides: Partial<ResourcePriceCandidate> = {},
): ResourcePriceCandidate {
  return {
    resourcePriceId: "rp-1",
    resourceId: "res-1",
    sourceId: null,
    price: "1200",
    priceBasisQuantity: "1000",
    currency: "MDL",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    ...overrides,
  };
}

function expectError(
  code: ResourceCalculationError["code"],
  run: () => unknown,
): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(
      error instanceof ResourceCalculationError,
      `expected ResourceCalculationError, got ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });
}

// --- Mandatory worked example ------------------------------------------------
{
  const line = calculateResourceLine(baseLine());
  // 250 / 100 × 3 × 1.1 = 8.25
  assert.equal(line.resourceQuantity, "8.25");
  // 1200 / 1000 = 1.2
  assert.equal(line.effectiveUnitPrice, "1.2");
  // 8.25 × 1.2 = 9.90 (canonical decimal string "9.9", equal to 9.90)
  assert.equal(line.resourceCost, "9.9");
  assert.ok(new Decimal(line.resourceCost).equals("9.90"));
  // Provenance is preserved for a later snapshot.
  assert.equal(line.estimateNormVersionId, "env-1");
  assert.equal(line.resourceConsumptionId, "rc-1");
  assert.equal(line.resourceId, "res-1");
  assert.equal(line.resourcePriceId, "rp-1");
  assert.equal(line.normApplicationId, "na-1");
  assert.equal(line.resourceType, "material");
  assert.equal(line.currency, "MDL");
}

// --- Validation: no silent correction ---------------------------------------
{
  expectError("norm_basis_not_positive", () =>
    calculateResourceLine(baseLine({ normBasisQuantity: "0" })),
  );
  expectError("norm_basis_not_positive", () =>
    calculateResourceLine(baseLine({ normBasisQuantity: "-100" })),
  );
  expectError("price_basis_not_positive", () =>
    calculateResourceLine(baseLine({ priceBasisQuantity: "0" })),
  );
  expectError("price_basis_not_positive", () =>
    calculateResourceLine(baseLine({ priceBasisQuantity: "-1" })),
  );
  expectError("application_coefficient_not_positive", () =>
    calculateResourceLine(baseLine({ applicationCoefficient: "0" })),
  );
  expectError("application_coefficient_not_positive", () =>
    calculateResourceLine(baseLine({ applicationCoefficient: "-1.1" })),
  );
  expectError("work_quantity_negative", () =>
    calculateResourceLine(baseLine({ workQuantity: "-1" })),
  );
  expectError("normative_consumption_negative", () =>
    calculateResourceLine(baseLine({ normativeConsumption: "-3" })),
  );
  expectError("resource_price_negative", () =>
    calculateResourceLine(baseLine({ resourcePrice: "-1200" })),
  );
  expectError("non_decimal_value", () =>
    calculateResourceLine(baseLine({ workQuantity: "abc" })),
  );
  expectError("non_decimal_value", () =>
    calculateResourceLine(baseLine({ workQuantity: "" })),
  );
  expectError("invalid_resource_type", () =>
    calculateResourceLine(
      baseLine({ resourceType: "concrete" as never }),
    ),
  );
}

// --- Boundary values that are allowed ---------------------------------------
{
  // Zero work quantity is valid and yields zero cost.
  const zeroWork = calculateResourceLine(baseLine({ workQuantity: "0" }));
  assert.equal(zeroWork.resourceQuantity, "0");
  assert.equal(zeroWork.resourceCost, "0");
  // Zero consumption and zero price are valid.
  assert.equal(
    calculateResourceLine(baseLine({ normativeConsumption: "0" })).resourceCost,
    "0",
  );
  assert.equal(
    calculateResourceLine(baseLine({ resourcePrice: "0" })).resourceCost,
    "0",
  );
}

// --- Decimal values unsafe under native JS float arithmetic -----------------
{
  // 0.1 / 1 × 0.2 × 1 = 0.02 (float 0.1*0.2 = 0.020000000000000004)
  const line = calculateResourceLine(
    baseLine({
      workQuantity: "0.1",
      normBasisQuantity: "1",
      normativeConsumption: "0.2",
      applicationCoefficient: "1",
      resourcePrice: "0.3",
      priceBasisQuantity: "3",
    }),
  );
  assert.equal(line.resourceQuantity, "0.02");
  // 0.3 / 3 = 0.1 (float 0.3/3 = 0.09999999999999999)
  assert.equal(line.effectiveUnitPrice, "0.1");
  // 0.02 × 0.1 = 0.002 (float would drift)
  assert.equal(line.resourceCost, "0.002");

  // Cross-check: the naive float computation is actually wrong here.
  const floatQuantity = (0.1 / 1) * 0.2 * 1;
  assert.notEqual(floatQuantity.toString(), "0.02");
}

// --- Non-terminating division is deterministic ------------------------------
{
  const input = baseLine({
    workQuantity: "1",
    normBasisQuantity: "3",
    normativeConsumption: "1",
    applicationCoefficient: "1",
  });
  const first = calculateResourceLine(input);
  const second = calculateResourceLine(input);
  assert.equal(first.resourceQuantity, second.resourceQuantity);
  // 40 significant digits of 1/3, deterministic and not rounded to money scale.
  assert.ok(first.resourceQuantity.startsWith("0.3333333333"));
  assert.ok(first.resourceQuantity.length > 10);
}

// --- Aggregation across labor / material / machinery ------------------------
{
  const result = calculateResources([
    baseLine({
      resourceType: "labor",
      resourcePrice: "100",
      priceBasisQuantity: "1",
      workQuantity: "10",
      normBasisQuantity: "1",
      normativeConsumption: "2",
      applicationCoefficient: "1",
    }), // qty 20 × 100 = 2000
    baseLine({
      resourceType: "material",
      resourcePrice: "1200",
      priceBasisQuantity: "1000",
      workQuantity: "250",
      normBasisQuantity: "100",
      normativeConsumption: "3",
      applicationCoefficient: "1.1",
    }), // 9.9
    baseLine({
      resourceType: "machinery",
      resourcePrice: "50",
      priceBasisQuantity: "1",
      workQuantity: "4",
      normBasisQuantity: "1",
      normativeConsumption: "1",
      applicationCoefficient: "1",
    }), // qty 4 × 50 = 200
  ]);

  assert.equal(result.currency, "MDL");
  assert.equal(result.lines.length, 3);
  assert.equal(result.totalsByResourceType.labor, "2000");
  assert.equal(result.totalsByResourceType.material, "9.9");
  assert.equal(result.totalsByResourceType.machinery, "200");
  assert.equal(result.totalsByResourceType.transport, "0");
  assert.equal(result.totalsByResourceType.energy, "0");
  assert.equal(result.totalsByResourceType.other, "0");
  // 2000 + 9.9 + 200 = 2209.9
  assert.equal(result.directResourceTotal, "2209.9");
}

// --- Empty calculation ------------------------------------------------------
{
  const result = calculateResources([]);
  assert.equal(result.currency, null);
  assert.equal(result.directResourceTotal, "0");
  assert.equal(result.totalsByResourceType.labor, "0");
}

// --- Mixed currency is rejected, not summed ---------------------------------
{
  expectError("mixed_currency", () =>
    calculateResources([
      baseLine({ currency: "MDL" }),
      baseLine({ currency: "EUR" }),
    ]),
  );
}

// --- Price eligibility: selected / missing / ambiguous ----------------------
{
  const valuationDate = "2026-06-15";

  const selected = selectEligibleResourcePrice([candidate()], valuationDate);
  assert.equal(selected.status, "selected");
  assert.equal(selected.eligible.length, 1);
  assert.equal(selected.selected?.resourcePriceId, "rp-1");

  const missing = selectEligibleResourcePrice(
    [candidate({ validFrom: "2027-01-01", validTo: "2027-12-31" })],
    valuationDate,
  );
  assert.equal(missing.status, "missing");
  assert.equal(missing.eligible.length, 0);
  assert.equal(missing.selected, null);

  const ambiguous = selectEligibleResourcePrice(
    [
      candidate({ resourcePriceId: "rp-a" }),
      candidate({ resourcePriceId: "rp-b", price: "1300" }),
    ],
    valuationDate,
  );
  // No tie-break rule is invented: overlapping prices stay ambiguous.
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.eligible.length, 2);
  assert.equal(ambiguous.selected, null);
}

// --- Price eligibility: candidates must share a resource --------------------
{
  // Mixing resources is an explicit validation error, not an ambiguous result.
  assert.throws(
    () =>
      selectEligibleResourcePrice(
        [
          candidate({ resourcePriceId: "rp-a", resourceId: "res-1" }),
          candidate({ resourcePriceId: "rp-b", resourceId: "res-2" }),
        ],
        "2026-06-15",
      ),
    (error: unknown) => {
      assert.ok(error instanceof PriceCandidateConsistencyError);
      assert.deepEqual(error.resourceIds, ["res-1", "res-2"]);
      return true;
    },
  );
}

// --- Price eligibility: inclusive boundaries and open-ended validTo ---------
{
  const onFrom = candidate({ validFrom: "2026-06-15", validTo: "2026-12-31" });
  assert.equal(isPriceDateEligible(onFrom, "2026-06-15"), true);

  const onTo = candidate({ validFrom: "2026-01-01", validTo: "2026-06-15" });
  assert.equal(isPriceDateEligible(onTo, "2026-06-15"), true);

  const openEnded = candidate({ validFrom: "2020-01-01", validTo: null });
  assert.equal(isPriceDateEligible(openEnded, "2026-06-15"), true);

  const beforeFrom = candidate({ validFrom: "2026-06-16", validTo: null });
  assert.equal(isPriceDateEligible(beforeFrom, "2026-06-15"), false);

  const afterTo = candidate({ validFrom: "2026-01-01", validTo: "2026-06-14" });
  assert.equal(isPriceDateEligible(afterTo, "2026-06-15"), false);
}

// --- Price eligibility: invalid dates are rejected --------------------------
{
  assert.throws(() =>
    selectEligibleResourcePrice([candidate()], "2026-13-01"),
  );
  assert.throws(() =>
    selectEligibleResourcePrice([candidate()], "not-a-date"),
  );
  assert.throws(() =>
    isPriceDateEligible(candidate({ validTo: "2026-02-30" }), "2026-01-01"),
  );
}

console.log("Professional resource calculation kernel checks passed.");
