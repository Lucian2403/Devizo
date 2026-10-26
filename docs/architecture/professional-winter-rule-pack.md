# M8.5C2B1 — Persistence of winter normative rules

This is the first incremental backend step toward winter costs in the general
estimate. It **does not yet add Chapter 9 costs to the application UI**.

Source: NCM L.02.06-2012, edition 2012,
https://ednc.gov.md/ncm-l-02-06-2012/.

## What is implemented

- Reuse the existing `professional_general_rule_definitions` table and
  composite FKs to an organization-owned normative source and a matching
  applicability decision.
- Migration 0026 widens only the CHECK for rule component, allowing
  `temporary_works` and `winter_conditions`. No previous data migration,
  permission expansion, new tables, change to cost decisions or valuation.
- Curated existing 58-rate Annex A pack is installed explicitly, only when the
  exact official normative source and a human "applicable" decision are present.
- Identity is (organization, source, component, ruleCode), so repeating the
  installation does not create more than 58 winter rows.
- A second explicit applicability revision **rebinds** provenance for the
  same IDs rather than making 116 records.
- Conflicting rule content and unknown extra winter rows are rejected. No
  overwrite or inferred fallback to a convenient percentage.
- The existing 47 temporary-works rules keep their component, IDs, foreign
  keys, eligibility and calculation behavior.

All operations run within the same tenant-scoped Drizzle access and existing
member RLS. No direct `DELETE` permission is granted.

## Current boundary

The installer is available through `getProfessionalWinterRulesService()` for
the next application integration. No user action can invoke it through the UI
in this milestone. For M8.5C2B2, introduce explicit source/decision controls,
persist winter selection, and join Chapter 9 after the Chapter 8 adjustment.

Do not invoke the rule installer automatically from page rendering: installation
is a deliberate governance action.

## Validation

Run on the branch:
```
pnpm db:migrate
pnpm db:policies
pnpm test:professional
pnpm typecheck
pnpm test:normative
pnpm test:ui
```

The migration is additive but applies to the application database, so run it
only after reviewing the SQL. For DB-backed tests **only** use a disposable
PostgreSQL 16 database with pgvector, set `DATABASE_TEST_URL` to that DB and
`CONFIRM_DISPOSABLE_DATABASE=yes`, then:

```
pnpm test:normative:db
```

Never set `DATABASE_TEST_URL` equal to the application's `DATABASE_URL`.

This PR must be reviewed and validated before merge. Browser testing will be
part of the following UI milestone.
