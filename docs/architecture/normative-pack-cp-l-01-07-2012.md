# Normative Rule Pack — CP L.01.07-2012

This note documents the first curated official rule pack in the professional
estimate domain (milestone M8.3E). It is additive and narrow: it does not
implement the whole normative, and it does not introduce a general legal-data
import system.

## Source

- **Code:** `CP L.01.07-2012`
- **Title:** *Instrucțiuni privind determinarea valorii cheltuielilor de
  achiziționare-depozitare în construcții*
- **Official E-DNC page:** https://ednc.gov.md/cp-l-01-07-2012/
- **Official PDF:** https://ednc.gov.md/wp-content/uploads/2023/06/CP-L.01.07-2012.pdf
- **Recorded official status:** in force
- **Approval date:** 2012-07-18
- **Effective / implementation date:** 2012-08-17
- **Edition:** 2012

The source itself is already part of the Moldova baseline registry
(`domain/professional-estimates/moldova-normative-baseline.ts`). The E-DNC page
is the provenance anchor; a monitored page change is only a human-review signal
and never mutates a rule by itself.

## What this pack implements

Only the verified investor sector-average procurement/storage rates from
clauses **3.2** and **3.3(a)/(c)**.

Clause 3.2 defines the base: procurement/storage cost is a percentage of
material cost **excluding transport costs and VAT**. Clause 3.3 gives the
sector-average rates applicable when estimate/tender documentation is prepared at
the investor's request.

| Rule name (slot) | Clause | Component | valueType | Basis | Value | Perspective | Work kind | Origin | Category |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Construction materials (investor) | 3.2, 3.3(a) | `procurement_storage` | `percent` | `material_cost` | `2` | `investor` | `any` | `normative_sector_average` | `construction_materials` |
| Metal structures (investor) | 3.2, 3.3(c) | `procurement_storage` | `percent` | `material_cost` | `0.75` | `investor` | `any` | `normative_sector_average` | `metal_structures` |

Each rule has `validFrom = 2012-08-17`, open-ended `validTo = null`, and
`sourceReference` citing the exact clauses. Decimal values stay as strings.

## Chain proven

```text
normative_sources (CP L.01.07-2012, edition 2012)
        ↓   getSource(organizationId, sourceId) identity gate
normative_applicability_decisions ("applicable", window covers 2012-08-17→…)
        ↓   M8.3D governance validation
professional_rule_definitions (2 investor rules)
        ↓   loadCandidatesForComponent("procurement_storage") re-gates official rules
M8.3C resolveProfessionalRule (category + perspective + date match)
        ↓   selected candidate value
M8.3B calculateProfessionalCostStack (percent of material cost)
```

### End-to-end arithmetic (homogeneous scenarios)

- **Construction materials**, material cost `100000 MDL`, investor,
  category `construction_materials` → rate `2%` → procurement/storage `2000` →
  direct cost `102000`.
- **Metal structures**, material cost `100000 MDL`, investor, category
  `metal_structures` → rate `0.75%` → procurement/storage `750` → direct cost
  `100750`.

## Why these choices

- **Investor sector-average rules are included** because clauses 3.2 and
  3.3(a)/(c) give explicit, verifiable rates for investor-prepared documentation
  with an unambiguous base (material cost excluding transport and VAT), which the
  M8.3B cost stack already models.
- **Contractor rules are not auto-created.** Under clauses 3.4 and 3.5 a
  contractor normally uses its own individual rates and may use these sector
  averages only *by agreement* between beneficiary and contractor. An agreement
  is never inferred; it belongs to a later, explicitly opted-in `contract_agreed`
  flow. A contractor resolution context does not select these investor rules.
- **The 1.2% equipment ("utilaje") rate from clause 3.3(b) is deferred.** The
  professional model does not yet have a sufficiently explicit equipment-cost
  base to map the normative meaning safely. Resolving the `equipment` category
  returns `missing`; no 1.2% rate is invented.
- **Mixed procurement-category allocation is not implemented.** The cost stack
  applies one selected procurement/storage rule to the single material-cost base
  supplied. This milestone does not split one estimate's material cost across
  `construction_materials`, `equipment` and `metal_structures`, and adds no AI or
  heuristic category inference. Each category is proven separately in a
  homogeneous calculation.

## Installer behavior

The installer (`domain/professional-estimates/official-rule-packs/cp-l-01-07-2012.ts`)
requires an explicit `organizationId`, `sourceId` and `applicabilityDecisionId`.

1. **Source identity gate.** Loads the persisted source with the
   organization-scoped `getSource(...)` (the caller supplies the exact id; no
   "latest source wins" resolution). Rejects with an `OfficialRulePackError`
   unless the source belongs to the organization and is `CP L.01.07-2012` /
   edition `2012`. Rules are never attached to another source merely because it
   has a valid applicability decision.
2. **Governance.** Every definition is official (`normative_sector_average`) and
   is created through the M8.3D rule-definition service, which re-validates the
   exact supplied `applicabilityDecisionId` (exists, same organization and
   source, decision `applicable`, decision window covers the rule validity). The
   installer does not search for a newer applicability revision and does not
   auto-supersede anything.
3. **Idempotency.** Re-installing with the same organization, source and
   applicability decision reuses existing exact definitions and creates no
   duplicates. A persisted definition in the same slot
   (`source + applicability decision + procurement category`) with a conflicting
   value or semantics fails explicitly with `conflicting_existing_definition`; an
   official definition is never mutated to a different rate. Idempotency is
   application-level over the persisted rule definitions; no migration is added
   for pack identity, and no `calculation_rules` row is created.

## Scope boundaries

This pack implements only verified clauses **3.2** and **3.3(a)/(c)** of
CP L.01.07-2012. It does **not** claim to implement the entire normative. It
adds no schema, UI, PDF/forms, VAT, annual profit rate, overhead rates, salary
rules, production auto-monitoring reaction, automatic legal applicability
decision, or AI category inference.
