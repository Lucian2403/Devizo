# M8.5C2A — Professional winter-conditions calculation foundation

Scope: pure NCM L.02.06-2012 data and deterministic arithmetic only. This milestone
does **not** expose winter costs in the application yet.

## Sources

- Official entry: https://ednc.gov.md/ncm-l-02-06-2012/
- Official 23-page PDF: https://ednc.gov.md/wp-content/uploads/2023/06/NCM-L.02.06-2012.pdf
- NCM L.02.06-2012, sections 1.2, 3.2-3.3, 4.1-4.9, Annex A (pages 5-7).

The Annex has 39 numbered main entries with 58 actual tariff variants. Entries
18, 19, 20, 26, 27 and 28 have lettered variants; 19 has no F variant.
The source registry entry was already introduced in the Moldova baseline.
Short row labels in code are navigational summaries; refer to Annex A for scope.

## General-estimate calculation order

1. Resolve current complete local, object and general estimates.
2. Apply NCM L.02.05 temporary works to Chapter 8 (existing M8.5C1).
3. Sum only **construction and installation columns of Chapters 1-8**, including
   the temporary-works amount already placed in Chapter 8. Do not include
   Chapter 9 costs, equipment, furniture, inventory or other-cost columns.
4. Calculate the winter amount for the selected, eligible Annex A tariff.
5. Place calculated construction and installation amounts in **Chapter 9**,
   columns 4/5; the total also contributes to column 8. Do not overwrite
   any preexisting Chapter 9 rows or recalculate the source estimate stack.

Annual average (project duration at least one year):
  winter = base × ratePercent / 100

Shorter project (explicit project schedule):
  K = winterDays / (durationDays × 0.23)
  winter = base × ratePercent / 100 × K

For short projects, the caller must verify the project's actual start/end
dates, its under-one-year classification and the winter-day count in the
project's organizing documentation. The reference and both day counts are
mandatory except that zero winter days is valid. Never infer these numbers
from today's date or local weather. Do not clamp K or substitute 4.3.

All arithmetic uses the existing Decimal kernel, including K, without rounding
to two monetary decimals. The caller must validate the exact selected rule's
eligibility and retain normative-source/applicability provenance before using
the kernel; these services and DB tables are NOT part of M8.5C2A.

## Applicability rules for the next integration stage

- NCM 4.7: residential and administrative buildings must be checked against
  Annex entries 22-23 regardless of the nominal construction category.
- NCM 4.8: entries 13-16, 17-21, 26-28, 30-33 and 36-39 require confirmation
  that this is **principal work** in the general estimate, rather than a
  secondary item. The pack carries a flag; it does not silently decide.
- NCM 4.6: do not add winter costs for current repairs performed in heated
  buildings. Require an explicit applicability check before saving.
- NCM 4.9: selecting an analogous type for an unlisted project must be an
  explicit documented human decision; never choose a generic fallback.
- NCM 3.3: project-specific heating, deep-frozen soil work and snow clearing
  are NOT included in the percentage norm. No invented additional rows.
- NCM 4.3-4.4: contractual settlement and negative-temperature day-by-day
  calculations are distinct from general-estimate annual valuation. Do not
  reuse the K=4.3 contractual coefficient in this module.

## Deferred deliberately

The persistence/reuse of 58 rules, organization-safe composite foreign keys,
RLS, exact-applicability decision, manual selection UI, stale provenance checks,
Chapter 9 service integration, project schedule validation and manual browser
acceptance are to follow in M8.5C2B. No migration, RLS or existing UI is
changed here. No adjustments to existing temporary works or quotes/PDFs.

## Regression fixture

The regression test starts from:
- Chapter 2 construction: 5051.2539 MDL
- Chapter 9 construction: 200 MDL (excluded from the winter base)
- Chapter 9 equipment: 100 MDL (excluded)
- Chapter 9 other costs: 20 MDL (excluded)

The accepted 0.8% temporary rule yields 40.4100312 MDL in Chapter 8.
The winter base is 5091.6639312 MDL, the explicit Annex A row 024 at 0.8%
yields 40.7333114496 MDL, and the final synthetic total becomes
5452.3972426496 MDL.

Short-project validation: D=100 days, Ptf=23 gives K=1; Ptf=46 gives K=2.
Tests also cover Chapter 9 exclusion, rule variants, negative and fractional
day rejection, empty provenance, zero winter days and stale-base protection.

Run: `pnpm test:professional`, `pnpm typecheck`, `pnpm test:normative`,
`pnpm test:ui`. These commands must be executed in a repository checkout
with installed dependencies before merge.
