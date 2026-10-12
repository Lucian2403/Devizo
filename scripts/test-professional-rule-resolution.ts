import assert from "node:assert/strict";
import {
  resolveProfessionalRule,
  RuleResolutionValidationError,
  type ProfessionalRuleCandidate,
  type ProfessionalRuleResolutionContext,
} from "../domain/professional-estimates/calculation";

/**
 * M8.3C professional rule-resolution tests.
 *
 * These exercise only the pure resolver: context/candidate matching and the
 * selected/missing/ambiguous result. No monetary arithmetic, no defaults and
 * no legal interpretation. Every percentage below is a labelled test fixture,
 * NOT a current universal default rate.
 */

function candidate(
  overrides: Partial<ProfessionalRuleCandidate> = {},
): ProfessionalRuleCandidate {
  return {
    candidateId: "cand-1",
    component: "overhead",
    valueType: "percent",
    value: "10", // fixture value only
    currency: null,
    calculationBasis: "direct_cost",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    estimatePerspective: "any",
    workKind: "any",
    ruleOrigin: "normative_sector_average",
    calculationRuleId: null,
    sourceId: null,
    sourceReference: null,
    applicabilityDecisionId: null,
    ...overrides,
  };
}

function context(
  overrides: Partial<ProfessionalRuleResolutionContext> = {},
): ProfessionalRuleResolutionContext {
  return {
    valuationDate: "2026-06-15",
    estimatePerspective: "investor",
    workKind: "construction",
    currency: "MDL",
    ...overrides,
  };
}

function expectValidationError(
  code: RuleResolutionValidationError["code"],
  run: () => unknown,
): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(
      error instanceof RuleResolutionValidationError,
      `expected RuleResolutionValidationError, got ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });
}

// 1 & 2. Investor vs contractor perspective matching (not priority).
{
  const investorProfit = candidate({
    candidateId: "profit-investor",
    component: "estimated_profit",
    calculationBasis: "estimate_cost_before_profit",
    estimatePerspective: "investor",
    ruleOrigin: "normative_sector_average",
    value: "6", // fixture
  });
  const contractorProfit = candidate({
    candidateId: "profit-contractor",
    component: "estimated_profit",
    calculationBasis: "estimate_cost_before_profit",
    estimatePerspective: "contractor",
    ruleOrigin: "company_individual",
    value: "9", // fixture
  });
  const candidates = [investorProfit, contractorProfit];

  const investor = resolveProfessionalRule(
    "estimated_profit",
    candidates,
    context({ estimatePerspective: "investor" }),
  );
  assert.equal(investor.status, "selected");
  assert.equal(investor.candidate?.candidateId, "profit-investor");

  const contractor = resolveProfessionalRule(
    "estimated_profit",
    candidates,
    context({ estimatePerspective: "contractor" }),
  );
  assert.equal(contractor.status, "selected");
  assert.equal(contractor.candidate?.candidateId, "profit-contractor");
}

// 3 & 4. Overhead work-kind matching selects the right basis candidate.
{
  const constructionOverhead = candidate({
    candidateId: "oh-construction",
    workKind: "construction",
    calculationBasis: "direct_cost",
  });
  const installationOverhead = candidate({
    candidateId: "oh-installation",
    workKind: "installation",
    calculationBasis: "labor_cost",
  });
  const candidates = [constructionOverhead, installationOverhead];

  const construction = resolveProfessionalRule(
    "overhead",
    candidates,
    context({ workKind: "construction" }),
  );
  assert.equal(construction.status, "selected");
  assert.equal(construction.candidate?.candidateId, "oh-construction");
  assert.equal(construction.candidate?.calculationBasis, "direct_cost");

  const installation = resolveProfessionalRule(
    "overhead",
    candidates,
    context({ workKind: "installation" }),
  );
  assert.equal(installation.status, "selected");
  assert.equal(installation.candidate?.candidateId, "oh-installation");
  assert.equal(installation.candidate?.calculationBasis, "labor_cost");
}

// 5, 6, 7. Date boundaries are inclusive; open-ended validTo is supported.
{
  const onFrom = candidate({ validFrom: "2026-06-15", validTo: "2026-12-31" });
  assert.equal(
    resolveProfessionalRule("overhead", [onFrom], context()).status,
    "selected",
  );
  const onTo = candidate({ validFrom: "2026-01-01", validTo: "2026-06-15" });
  assert.equal(
    resolveProfessionalRule("overhead", [onTo], context()).status,
    "selected",
  );
  const openEnded = candidate({ validFrom: "2020-01-01", validTo: null });
  assert.equal(
    resolveProfessionalRule("overhead", [openEnded], context()).status,
    "selected",
  );
}

// 8. Date outside range -> missing (not zero, not not_applicable).
{
  const future = candidate({ validFrom: "2027-01-01", validTo: "2027-12-31" });
  const result = resolveProfessionalRule("overhead", [future], context());
  assert.equal(result.status, "missing");
  assert.equal(result.candidate, null);
  assert.equal(result.eligibleCandidates.length, 0);

  const past = candidate({ validFrom: "2025-01-01", validTo: "2025-12-31" });
  assert.equal(
    resolveProfessionalRule("overhead", [past], context()).status,
    "missing",
  );
}

// 9. Two fully matching rules -> ambiguous (no tie-break by anything).
{
  const a = candidate({
    candidateId: "oh-a",
    estimatePerspective: "investor",
    workKind: "construction",
    ruleOrigin: "normative_sector_average",
    value: "14.5", // fixture
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  });
  const b = candidate({
    candidateId: "oh-b",
    estimatePerspective: "investor",
    workKind: "construction",
    ruleOrigin: "normative_sector_average",
    value: "16", // fixture; higher rate must NOT win
    validFrom: "2026-02-01",
    validTo: null, // different range must NOT be used as a tie-break
  });
  const result = resolveProfessionalRule(
    "overhead",
    [a, b],
    context({ estimatePerspective: "investor", workKind: "construction" }),
  );
  assert.equal(result.status, "ambiguous");
  assert.equal(result.candidate, null);
  assert.equal(result.eligibleCandidates.length, 2);
}

// 10. No matching rule for the component -> missing.
{
  const other = candidate({ component: "labor_contributions" });
  const result = resolveProfessionalRule("overhead", [other], context());
  assert.equal(result.status, "missing");
  assert.equal(result.eligibleCandidates.length, 0);
}

// 11. Perspective mismatch excludes the candidate.
{
  const investorOnly = candidate({ estimatePerspective: "investor" });
  const result = resolveProfessionalRule(
    "overhead",
    [investorOnly],
    context({ estimatePerspective: "contractor" }),
  );
  assert.equal(result.status, "missing");
}

// 12. Work-kind mismatch excludes the candidate.
{
  const constructionOnly = candidate({ workKind: "construction" });
  const result = resolveProfessionalRule(
    "overhead",
    [constructionOnly],
    context({ workKind: "installation" }),
  );
  assert.equal(result.status, "missing");
}

// 13. Fixed-amount currency mismatch excludes the candidate.
{
  const eurFixed = candidate({
    candidateId: "transport-fixed",
    component: "material_transport",
    valueType: "fixed_amount",
    calculationBasis: "fixed_amount",
    value: "100", // fixture
    currency: "EUR",
    estimatePerspective: "any",
    workKind: "any",
  });
  const mismatch = resolveProfessionalRule(
    "material_transport",
    [eurFixed],
    context({ currency: "MDL" }),
  );
  assert.equal(mismatch.status, "missing");

  const match = resolveProfessionalRule(
    "material_transport",
    [eurFixed],
    context({ currency: "EUR" }),
  );
  assert.equal(match.status, "selected");
  assert.equal(match.candidate?.candidateId, "transport-fixed");
}

// 14. Malformed dates are rejected.
{
  expectValidationError("invalid_date", () =>
    resolveProfessionalRule(
      "overhead",
      [candidate({ validFrom: "2026-13-01" })],
      context(),
    ),
  );
  expectValidationError("invalid_date", () =>
    resolveProfessionalRule("overhead", [candidate()], context({ valuationDate: "nope" })),
  );
  expectValidationError("invalid_validity_range", () =>
    resolveProfessionalRule(
      "overhead",
      [candidate({ validFrom: "2026-12-31", validTo: "2026-01-01" })],
      context(),
    ),
  );
}

// 15. Negative and malformed values are rejected.
{
  expectValidationError("negative_value", () =>
    resolveProfessionalRule("overhead", [candidate({ value: "-1" })], context()),
  );
  expectValidationError("invalid_decimal", () =>
    resolveProfessionalRule("overhead", [candidate({ value: "abc" })], context()),
  );
}

// 16. contract_agreed vs company_individual overlap stays ambiguous unless the
//     context explicitly distinguishes them via restrictToOrigins.
{
  const companyRule = candidate({
    candidateId: "storage-company",
    component: "procurement_storage",
    procurementCategory: "any",
    estimatePerspective: "contractor",
    ruleOrigin: "company_individual",
    value: "2", // fixture
  });
  const contractRule = candidate({
    candidateId: "storage-contract",
    component: "procurement_storage",
    procurementCategory: "any",
    estimatePerspective: "contractor",
    ruleOrigin: "contract_agreed",
    value: "2.5", // fixture
  });
  const candidates = [companyRule, contractRule];

  const ambiguous = resolveProfessionalRule(
    "procurement_storage",
    candidates,
    context({ estimatePerspective: "contractor" }),
  );
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.eligibleCandidates.length, 2);

  const resolved = resolveProfessionalRule(
    "procurement_storage",
    candidates,
    context({
      estimatePerspective: "contractor",
      restrictToOrigins: ["contract_agreed"],
    }),
  );
  assert.equal(resolved.status, "selected");
  assert.equal(resolved.candidate?.candidateId, "storage-contract");
}

// 17. A category-specific procurement/storage candidate needs an explicit
//     matching context category; the resolver never guesses the category.
{
  const equipmentRule = candidate({
    candidateId: "storage-equipment",
    component: "procurement_storage",
    procurementCategory: "equipment",
    estimatePerspective: "investor",
    ruleOrigin: "normative_sector_average",
    value: "1.2", // fixture
  });

  // Context without a category cannot match a category-specific candidate.
  const withoutCategory = resolveProfessionalRule(
    "procurement_storage",
    [equipmentRule],
    context({ estimatePerspective: "investor" }),
  );
  assert.equal(withoutCategory.status, "missing");

  // Wrong category does not match.
  const wrongCategory = resolveProfessionalRule(
    "procurement_storage",
    [equipmentRule],
    context({
      estimatePerspective: "investor",
      procurementStorageCategory: "metal_structures",
    }),
  );
  assert.equal(wrongCategory.status, "missing");

  // Explicit matching category resolves.
  const matched = resolveProfessionalRule(
    "procurement_storage",
    [equipmentRule],
    context({
      estimatePerspective: "investor",
      procurementStorageCategory: "equipment",
    }),
  );
  assert.equal(matched.status, "selected");
  assert.equal(matched.candidate?.candidateId, "storage-equipment");

  // A procurement/storage candidate without an explicit category is rejected.
  expectValidationError("missing_procurement_category", () =>
    resolveProfessionalRule(
      "procurement_storage",
      [
        candidate({
          candidateId: "storage-noscope",
          component: "procurement_storage",
          procurementCategory: undefined,
        }),
      ],
      context({ procurementStorageCategory: "equipment" }),
    ),
  );
}

// Additional validation coverage: origin, perspective, basis, provenance.
{
  expectValidationError("invalid_origin", () =>
    resolveProfessionalRule(
      "overhead",
      [candidate({ ruleOrigin: "unknown_origin" as never })],
      context(),
    ),
  );
  expectValidationError("missing_perspective", () =>
    resolveProfessionalRule(
      "overhead",
      [candidate({ estimatePerspective: "beneficiary" as never })],
      context(),
    ),
  );
  expectValidationError("invalid_basis", () =>
    resolveProfessionalRule(
      "overhead",
      [candidate({ calculationBasis: "mystery" as never })],
      context(),
    ),
  );
  expectValidationError("fixed_amount_missing_currency", () =>
    resolveProfessionalRule(
      "material_transport",
      [
        candidate({
          component: "material_transport",
          valueType: "fixed_amount",
          calculationBasis: "fixed_amount",
          currency: null,
        }),
      ],
      context(),
    ),
  );
  expectValidationError("empty_provenance_reference", () =>
    resolveProfessionalRule(
      "overhead",
      [candidate({ sourceId: "  " })],
      context(),
    ),
  );
  expectValidationError("missing_candidate_id", () =>
    resolveProfessionalRule("overhead", [candidate({ candidateId: "" })], context()),
  );
}

// Provenance is preserved on a selected candidate.
{
  const withProvenance = candidate({
    candidateId: "oh-provenance",
    estimatePerspective: "investor",
    workKind: "construction",
    calculationRuleId: "rule-55",
    sourceId: "source-9",
    sourceReference: "CP L.01.03-2012 example",
    applicabilityDecisionId: "decision-3",
  });
  const result = resolveProfessionalRule(
    "overhead",
    [withProvenance],
    context({ estimatePerspective: "investor", workKind: "construction" }),
  );
  assert.equal(result.status, "selected");
  assert.equal(result.candidate?.calculationRuleId, "rule-55");
  assert.equal(result.candidate?.sourceId, "source-9");
  assert.equal(result.candidate?.sourceReference, "CP L.01.03-2012 example");
  assert.equal(result.candidate?.applicabilityDecisionId, "decision-3");
  assert.equal(result.candidate?.ruleOrigin, "normative_sector_average");
  assert.equal(result.candidate?.validFrom, "2026-01-01");
  assert.equal(result.candidate?.validTo, "2026-12-31");
}

// Context-neutral ("any") candidates match any perspective/work kind.
{
  const neutral = candidate({
    candidateId: "contrib-any",
    component: "labor_contributions",
    calculationBasis: "labor_cost",
    estimatePerspective: "any",
    workKind: "any",
    ruleOrigin: "statutory",
    value: "26.5", // fixture
  });
  for (const perspective of ["investor", "contractor"] as const) {
    const result = resolveProfessionalRule(
      "labor_contributions",
      [neutral],
      context({ estimatePerspective: perspective }),
    );
    assert.equal(result.status, "selected");
    assert.equal(result.candidate?.candidateId, "contrib-any");
  }
}

console.log("Professional rule resolution checks passed.");
