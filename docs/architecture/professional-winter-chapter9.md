# M8.5C2B2 — winter conditions in the general estimate

This milestone connects the **NCM L.02.06-2012** Annex A rule pack from M8.5C2B1 to
the general estimate screen. It does not alter the older NCM L.02.05 temporary
works calculation, the commercial quote domain, reserve, TVA or SDNC.

## User flow

1. Complete the base general estimate, including Chapter 8 temporary works.
2. Create/verify the NCM L.02.06-2012 source and applicability decision via
   the normative register. Install/verify the 58 rows using the new pack panel.
3. Select a persisted, eligible Annex A row and explicitly classify the works.
   For residential/administrative buildings, entries 22–23 are required; rows
   subject to section 4.8 require principal-work confirmation. Analogy needs a
   textual project justification.
4. Select annual-average valuation (one year or longer) or a shorter project.
   Short projects require the real start/end dates, an explicit number of
   negative-temperature days from the project schedule and a project reference.
   The service calculates inclusive calendar days, verifies the project is
   shorter than a calendar year, rejects invalid/negative/excess winter days,
   and delegates K = Ptf / (D * 0.23) to the pure Decimal kernel.
5. The calculation uses **construction and installation columns, Chapters 1–8**
   *after* adding temporary works to Chapter 8, then adds winter amounts only to
   Chapter 9 construction/installation and total. Existing Chapter 9 inputs
   and equipment are preserved.
6. For current repairs inside a heated building, an explicit `not_applicable`
   choice records the section 4.6 reason and carries Chapter 8 totals through
   unchanged.

A missing decision, stale source/rule/decision, incomplete Chapter 8, altered
normative value or invalid schedule blocks the adjusted subtotal. There are
no silent fallback rates and no conflation with NCM 4.3 contractual settlement.

## Data and security

Migration 0027 adds `professional_winter_decisions` (separate from
`professional_general_cost_decisions`). It has organization-safe composite
FKs to general estimates and exact winter rule identity, a single decision per
general estimate, mode/field-shape CHECK constraints and member RLS policies in
`0011_professional_winter_decisions_rls.sql`. No DELETE permission is provided.

The service validates dates, classification, rule integrity, section 4.8 flags
and declared analogy before upsert. Project dates remain editable explicitly,
and the live general estimate is re-evaluated when rendered, not frozen.

## Validation

- `pnpm typecheck`, `pnpm test:professional`, `pnpm test:normative`,
  `pnpm test:ui`
- `pnpm test:normative:db` on a disposable PostgreSQL 16 + pgvector database.
  The `PostgreSQL integration` GitHub Actions workflow runs all commands on
  pull requests; local Docker is not required.
- Browser acceptance: install 58 rules, select a listed rule, check base
  Chapters 1–8, save an annual rate, verify Chapter 9, switch to a shorter
  project, use zero winter days, try invalid/missing principal/analogy inputs,
  choose non-applicable, and verify stale rule blocking.

**Limitations:** annual duration is a user assertion; for projects with multiple
construction categories or special winter measures, the current single-row
calculation is not an automatic per-trade allocation. The official Annex A and
project/POS remain the authoritative basis. Neither contractual-day settlement
nor reservation/TVA are included.
