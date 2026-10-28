# M8.5D1 — Rezerva de mijloace pentru cheltuieli neprevăzute

**Source:** CP L.01.01-2012, pct. 6.11, official second edition,
https://ednc.gov.md/wp-content/uploads/2023/06/CP-L.01.01-2012.pdf
(official E-DNC entry: https://ednc.gov.md/cp-l-01-01-2012/).

This is a distinct line **after Chapters 1–12**, not a new Chapter 9 cost.
The rule defines three explicit cases:

| Classification | Rate | Evidence |
| --- | ---: | --- |
| Obiectiv din sfera socială | 2% | Pct. 6.11 |
| Obiectiv de producere | 3% | Pct. 6.11 |
| Studiu sau calcul tehnico-economic | 6% | Pct. 6.11 |

No fallback classification or rate is inferred.

## Calculation and user flow

1. Complete general estimate, Chapter 8 temporary works, and Chapter 9 winter
   conditions (including explicit not-applicable where legally appropriate).
2. Register and confirm the exact CP L.01.01-2012 source and applicable
   governance revision at the valuation date in Baza normativă.
3. In the general-estimate detail page, choose a classification and provide a
   free-text basis referencing the project or investment documentation.
4. The service validates current source status and **latest** applicability
   revision before writing the decision. A revoked/stale decision blocks output.
5. The Decimal kernel applies the chosen percent separately to construction,
   installation, equipment and other costs from the adjusted Chapters 1–12
   subtotal. It computes an independent reserve row and the subtotal
   **with reserve**, without mutating chapters. No intermediate money rounding.

The saved selection and provenance are stored in
`professional_general_reserve_decisions` (migration 0028) with organization-safe
source, applicability and estimate foreign keys, a unique estimate slot,
category/note checks, and member RLS (policy 0012, no DELETE permission).

## Boundaries

- This is an **estimate** reserve, not an automatically payable contractor
  allowance. The contractual treatment depends on the beneficiary/contract.
- SDNC is calculated **after** the reserve according to CP L.01.01-2012
  section 6.12. VAT (6.14) and the final General Estimate remain deferred,
  with explicit warnings.
- Does not apply reserve to incomplete / ineligible Chapter 1–12 subtotals,
  does not infer construction category from an object title or company profile.
- The source registry requires deliberate user confirmation; adding a row to
  the normative registry is not legal confirmation of the specific project.

## Validation

GitHub `PostgreSQL integration` runs the TypeScript, professional,
normative, UI and PostgreSQL 16/RLS suites for every PR.

After CI passes, browser acceptance with a **development** database:
- Apply `pnpm db:migrate`, then `pnpm db:policies` on the **confirmed**
  development database (not production).
- Verify CP L.01.01-2012 in the normative registry, set the explicit
  applicability decision where warranted.
- Open an already complete general estimate. Select 'social' and enter a
  reference note; verify 2% of the subtotal is placed on a new reserve row.
- Switch to production (3%) and feasibility (6%) and ensure the chapters
  themselves stay unchanged.
- Verify missing category/note cannot be submitted and that a later
  normative revocation blocks the computed reserve.

Do not call this the legally finalized general estimate until SDNC,
VAT, other required costs, freeze/approval and Form 9 have been implemented.
