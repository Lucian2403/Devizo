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

Clause 3.2 requires procurement/storage cost to be calculated as a percentage
of material cost **excluding transport costs and VAT**. Clause 3.3 gives the
sector-average rates applicable when estimate/tender documentation is prepared
at the investor's request. This is the normative requirement; the current
professional price model does not carry VAT-basis provenance to prove arbitrary
resource prices satisfy it.

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

### End-to-end arithmetic (VAT-exclusive homogeneous scenarios)

- **Construction materials**, material base assumed/known to be VAT-exclusive,
  `100000 MDL`, investor,
  category `construction_materials` → rate `2%` → procurement/storage `2000` →
  direct cost `102000`.
- **Metal structures**, material base assumed/known to be VAT-exclusive,
  `100000 MDL`, investor, category
  `metal_structures` → rate `0.75%` → procurement/storage `750` → direct cost
  `100750`.

These deterministic test scenarios prove the rule resolution and arithmetic
chain only. Their material-price inputs are explicitly assumed/known to be
VAT-exclusive; they do not prove that M8.3B can establish the VAT basis of
arbitrary resource-price data.

## Why these choices

- **Investor sector-average rules are included** because clauses 3.2 and
  3.3(a)/(c) give explicit, verifiable rates for investor-prepared
  documentation. The cost stack applies them to material cost and keeps
  transport separate, but it cannot yet verify whether material prices exclude
  VAT.
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

### VAT-basis limitation

M8.3E does **not** implement VAT calculation or prove VAT-exclusive resource
prices. The cost stack has a separate transport resource total, so transport is
excluded from its material-cost base. However, `ResourcePrice` / `materialCost`
has no explicit tax-basis metadata, and VAT-exempt-object handling is not
implemented. This matters because CP L.01.01-2012 distinguishes VAT treatment
for objects that are legally VAT-exempt.

Automatic real-estimate orchestration must not assume an unknown material price
is VAT-exclusive. This limitation must be resolved before orchestration applies
CP L.01.07 automatically to arbitrary resource-price data. The M8.3E arithmetic
fixtures use a VAT-exclusive homogeneous material base by explicit assumption;
they do not add VAT rates, VAT calculation or a VAT schema.

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
   source, decision `applicable`, decision window covers the rule validity).
   Reused rows are re-gated against that same exact linked decision before
   installation succeeds. The installer does not search for a newer
   applicability revision and does not auto-supersede anything.
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
adds no schema, PDF/forms, VAT, annual profit rate, overhead rates, salary
rules, production auto-monitoring reaction, automatic legal applicability
decision, or AI category inference. M8.3F adds only the bounded activation and
technical verification UI described below, not a general normative editor.

## M8.3F manual UI verification

The `/normative` page exposes an explicit installer for this exact source and
edition. Only an applicable decision belonging to this source can be selected;
the selector starts blank and installation passes the selected decision ID
through to the existing installer. Re-installation reports created/reused
counts. Persisted rule definitions are loaded by organization and source, and
the optional calculation panel loads candidates through the M8.3D governance
gate before using M8.3C, M8.3A and M8.3B.

The panel is only a technical verification instrument, not a professional
estimate editor or final estimate. Its material base is manually supplied,
explicitly declared VAT-exclusive, and excludes delivery transport. It does not
allocate mixed categories or implement equipment, contractor-specific rates,
VAT, overhead, salary, estimated profit or final forms. It creates no
professional calculation snapshot and changes no commercial quote.

Preview inputs stay in controlled client state after submission, including
missing/ambiguous results and expected validation errors. They start empty and
are not stored in the URL or database. A selected result preserves its submitted
valuation date, category and material base independently of later form edits.
Percentages use display-only string formatting (for example `0.750000` becomes
`0,75`), without changing persisted values or Decimal calculations.

### Manual acceptance checklist

1. `git pull`
2. start Devizo locally
3. open `/normative`
4. ensure Moldova baseline is loaded
5. locate `CP L.01.07-2012`
6. if necessary, record an explicit applicability decision:
   - decision: Aplicabilă
   - applicableFrom appropriate to the verified source
   - explicit basis note
   - evidence link
7. choose that exact applicability decision in the CP L.01.07 Rule Pack panel
8. click "Instalează / verifică regulile"
9. visually confirm two persisted rules appear
10. click install again
11. confirm no duplicates are created
12. use "Verificare calcul":
    - 100000
    - construction_materials
    - investor / MDL fixed by the panel
13. confirm:
    - 2%
    - 2000
    - 102000
14. switch to metal_structures
15. confirm:
    - 0.75%
    - 750
    - 100750
16. refresh the page and confirm the rules remain visible
