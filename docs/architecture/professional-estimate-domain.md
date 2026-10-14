# Professional Resource-Based Estimate Domain

This document defines the M8 professional bounded context. It is additive to
the commercial offer engine and must remain structurally separate from it.

## Normative basis

The initial Moldova workflow follows the resource method described by
CP L.01.01-2012. The model is intentionally version-aware because normative
documents and norm collections can be amended or replaced. A calculation must
therefore point to explicit source/version/validity data rather than assuming
that one hardcoded edition is eternally current.

Companion rules for salary, overhead, machinery operation, estimated profit,
procurement/storage and other components are represented as explicit
CalculationRule records. Overhead and estimated profit are separate rule types.

## Core chain

```text
WORK QUANTITY POSITION
        ↓
NORM APPLICATION
        ↓
ESTIMATE NORM VERSION
        ↓
RESOURCE CONSUMPTIONS
        ↓
PROFESSIONAL RESOURCES
        ↓
RESOURCE PRICES AT VALUATION DATE
        ↓
DETERMINISTIC CALCULATION RULES
        ↓
PROFESSIONAL CALCULATION SNAPSHOT (later M8 slice)
        ↓
F1 / F3 / F5 / other professional documents
```

## Hard boundaries

- `Project != ConstructionObject`. A project may link to one or more professional
  construction objects, but they are not the same record.
- `catalog_item != estimate_norm`.
- `catalog_item != professional_resource`.
- `quote_item != work_quantity_item`.
- A commercial selling price is never copied into ResourcePrice automatically.
- A professional unit price is never entered directly. It is derived from
  resource consumption, resource prices and calculation rules.
- Normative source/version/validity is data, not a constant hidden in code.
- AI may suggest mappings later; it never creates authoritative quantities,
  consumptions, prices or monetary results without deterministic validation.

## Quantity and norm basis

A norm may be defined for a basis other than one unit (for example 100 m²).
Therefore EstimateNormVersion stores both `basisQuantity` and `basisUnit`.

For one applied norm:

```text
resource quantity
  = work quantity / norm basis quantity
  × resource consumption per norm basis
  × application coefficient
```

Resource cost is then derived from the selected ResourcePrice and its own price
basis quantity. This is why Work, Norm, ResourceConsumption, Resource and
ResourcePrice remain separate records.

## M8.0 scope

M8.0 establishes persistence, tenant boundaries and domain semantics only. It
does not generate F5 and does not create an immutable professional calculation
snapshot yet. Those come after the deterministic calculator has a stable input
contract.

## M8.2 normative governance and publication

Normative monitoring creates review signals only. Explicit review is recorded
separately from an explicit, revisioned applicability decision. Source
relationships (amendment, replacement, supersession, supplement, corrigendum or
general relation) preserve direction and provenance without erasing the
historical source edition.

An `EstimateNormVersion` moves through draft, review, approval and publication.
Resource consumptions can be inserted, updated or deleted only in `draft`;
`in_review`, `approved` and `published` parents freeze all consumption rows.
Corrections before publication require returning through review to draft.
Once published, version fields and consumptions stay immutable;
normative changes require a new version rather than in-place edits. Publication
does not automatically update resource prices, calculation rules, existing
applications or any calculation.

`published` is a content lifecycle state, not proof of applicability.
A future calculation must also require an applicable source decision valid for
its valuation date and exact source/version provenance. Selection is deferred.
Governance history preserves actor UUIDs after membership/account removal;
membership is checked by database INSERT guards rather than permanent actor
FKs. Applicability source snapshots are validated by the database on insertion.
Applicability corrections append revisions; review/relation corrections are
deferred and must not be implemented by editing or deleting old audit rows.

## M8.3A deterministic resource calculation kernel

M8.3A adds the pure deterministic core of the resource method and nothing else.
It lives in `domain/professional-estimates/calculation/` and is independent of
the commercial quote pricing engine (`domain/quotes/pricing.ts`). It does not
read catalog items, selling prices or commercial quote prices, and it performs
no database access, UI, PDF, VAT, overhead, estimated profit, transport,
procurement/storage, salary or AI behaviour.

All arithmetic uses a fixed decimal.js configuration (`calculation/decimal.ts`:
40 significant digits, plain notation). Native JavaScript floating-point
arithmetic is never used for quantities or money. Quantities and prices stay as
decimal strings on the way in and out; the kernel does not round to a money
scale, because official-form rounding rules are a separate, later concern.

Formulas implemented (`calculation/resource-calculation.ts`):

```text
resourceQuantity   = workQuantity / normBasisQuantity
                     × normativeConsumption × applicationCoefficient
effectiveUnitPrice = resourcePrice / priceBasisQuantity
resourceCost       = resourceQuantity × effectiveUnitPrice
```

Per-resource results echo their inputs and preserve provenance identifiers
(estimate norm version, resource consumption, resource, resource price and
norm application) so a later professional calculation snapshot can reference the
exact records used. Costs are aggregated deterministically by resource type
(labor, material, machinery, transport, energy, other) and as a single direct
resource total. These totals carry no normative meaning beyond simple addition.
All lines in one calculation must share a currency; mixing currencies is
rejected rather than silently summed, because the kernel performs no conversion.

Validation rejects, without silent correction: `normBasisQuantity <= 0`,
`priceBasisQuantity <= 0`, `applicationCoefficient <= 0`, `workQuantity < 0`,
`normativeConsumption < 0`, `resourcePrice < 0`, non-decimal inputs and unknown
resource types.

Price eligibility is a separate pure function (`calculation/price-eligibility.ts`).
A ResourcePrice is date-eligible when `validFrom <= valuationDate` and
(`validTo is null` or `valuationDate <= validTo`); both boundaries are
inclusive. The result distinguishes exactly one eligible price (`selected`),
zero (`missing`) and more than one (`ambiguous`). No overlap tie-break rule is
invented: ambiguity stays visible because no confirmed normative rule exists for
resolving overlapping prices yet.

M8.3A does not change the `CalculationRule` schema and does not implement
calculation-rule semantics (overhead, estimated profit, procurement/storage and
similar), which require separate normative analysis. It also does not build the
calculation snapshot persistence; it only preserves the references a snapshot
will later need.

## M8.3B professional cost stack semantics

M8.3B adds a pure cost-stack function in
`domain/professional-estimates/calculation/cost-stack.ts`. It accepts the M8.3A
resource calculation result (currency, `totalsByResourceType` and
`directResourceTotal`) and explicit decisions for labor contributions,
material delivery transport, procurement/storage, overhead and estimated
profit. Every component must say either `applied` with an already-resolved
rule, or `not_applicable` with a reason. Missing or malformed decisions fail;
the calculator does not decide which rules apply and never supplies default
rates.

The cost stack takes the raw resource totals and their currency together as one
structured M8.3A result rather than as independent values, so a caller cannot
relabel EUR totals as MDL. The currency must be a non-null, non-empty string:
an empty M8.3A calculation has currency `null` and is rejected rather than
assigned an invented currency. As an integrity check, the recomputed raw total
(`labor + material + machinery + transport + energy + other`) must equal the
supplied `directResourceTotal` exactly by Decimal comparison; a mismatch is a
validation error and no rounding is introduced.

The implemented order is:

```text
raw resource totals (labor + material + machinery + transport + energy + other)
→ labor contributions (if applied)
→ material delivery/transport (if applied)
→ procurement/storage (if applied)
→ direct cost
→ overhead (if applied)
→ estimate cost before profit
→ estimated profit (if applied)
→ estimate subtotal before limited costs and VAT
```

Formulas and explicit bases:

```text
labor contributions = labor cost × rate percent / 100
percentage material transport = material base cost × rate percent / 100
fixed material transport = supplied fixed amount in calculation currency
procurement/storage = material base cost × rate percent / 100
direct cost = raw resource total + labor contributions
              + material delivery/transport + procurement/storage
overhead = (direct cost OR labor cost, explicitly selected) × rate percent / 100
estimate cost before profit = direct cost + overhead
estimated profit = estimate cost before profit × rate percent / 100
estimate subtotal before limited costs and VAT
  = estimate cost before profit + estimated profit
```

Material transport here means delivery/procurement transport added outside
normative resource consumption. Procurement/storage applies to the supplied
material-cost base, while transport is a separate cost-stack component. This
separates transport from that base, but the model has no tax-basis provenance to
verify that arbitrary material prices exclude VAT. The CP L.01.07-2012 VAT
exclusion is therefore a required input condition, not a guarantee made by the
calculator. The calculator also does not infer whether a stored material price
already includes transport/storage; source data normalization is deferred.
Percentage, overhead basis, fixed amount and not-applicable decisions must be
supplied by the caller. Unsupported transport methods such as tonne-km are
rejected instead of approximated.

For an applied component the result retains supplied rule type and, when
provided, calculation-rule ID, source ID and source reference, together with
the actual basis, rate or fixed value, and amount. `not_applicable` decisions
retain their reason and produce a deterministic zero component. All arithmetic
uses M8.3A's 40-significant-digit Decimal helper, retains decimal strings and
does not round intermediate/display amounts to two decimal places. Mixed
currencies are not converted or combined: fixed material transport must match
the calculation currency, and the stack itself has one currency.

The historical CP L.01.01-2012 example in the kernel tests uses 26.5%, 7%, 2%,
14.5% and 6% solely as an arithmetic/order fixture. None is a default or a
current-rate claim. Likewise CP L.01.02-2012/A4:2026's 116.43 MDL/hour investor
estimate is versioned source data, not a permanent calculator constant; that
hourly price belongs upstream as a labor ResourcePrice.

The stack is not a rule-selection or normative-applicability engine. It does
not alter `CalculationRule` or any database schema and does not calculate VAT,
limited costs, salary, tonne-km transport, investor/contractor-specific rates,
or professional snapshots. Future rule resolution must provide explicit
versioned/provenance-aware decisions; it must not infer these rates from this
historical test fixture.

## M8.3C professional rule resolution

M8.3C adds a pure candidate rule resolver in
`domain/professional-estimates/calculation/rule-resolution.ts`. It answers only
"given an explicit context and a set of already-curated candidate rules, which
candidate is eligible for one cost component?" It does not answer "what is the
legally correct Moldovan rate?" and never seeds or hard-codes rates.

The three professional calculation responsibilities stay separate:

```text
M8.3A  raw resource calculation (quantities and resource costs)
   ↓
M8.3C  explicit candidate rule resolution (which rule is eligible)
   ↓
M8.3B  cost-stack application (apply the resolved rate deterministically)
```

A service may later orchestrate this order, but the resolver performs no
monetary arithmetic: it returns a resolved candidate or an explicit unresolved
state and never applies a rate.

Resolution context (`ProfessionalRuleResolutionContext`) carries the valuation
date, `estimatePerspective` (`investor` or `contractor`, per CP L.01.01-2012),
`workKind` (a deliberately small explicit set: `construction`, `installation`,
`commissioning`), the currency, an optional explicit
`procurementStorageCategory`, and an optional explicit `restrictToOrigins`.
Perspective and work kind come from the caller; the resolver never classifies a
work item or a resource.

A `ProfessionalRuleCandidate` carries its component, value type, value,
currency, calculation basis, validity period, perspective and work-kind
applicability (each may be the literal `any` to mark an explicitly
context-neutral candidate), `ruleOrigin`, an optional procurement/storage
category, and provenance references (`calculationRuleId`, `sourceId`,
`sourceReference`, `applicabilityDecisionId`). Resolution covers the five M8.3B
components: labor contributions, material transport, procurement/storage,
overhead and estimated profit. Labor hourly salary is not resolved here; it
remains a `ResourcePrice` upstream.

Matching requires: component match; inclusive `validFrom <= valuationDate` and
(`validTo` null or `valuationDate <= validTo`) with strict `YYYY-MM-DD`
validation consistent with M8.3A; perspective match unless the candidate is
`any`; work-kind match unless the candidate is `any`; for a `fixed_amount`
candidate, currency equal to the context currency; and for a category-specific
`procurement_storage` candidate, an explicit matching
`procurementStorageCategory`. Context-neutral is only honored when explicitly
represented as `any`; a missing field is never inferred as neutral.

Each candidate must also satisfy the component/value-type/basis contract that
M8.3B can actually apply; otherwise it is rejected with
`incompatible_rule_semantics`. The supported combinations are: labor
contributions = `percent` on `labor_cost`; material transport = `percent` on
`material_cost` or `fixed_amount` on `fixed_amount` (currency required);
procurement/storage = `percent` on `material_cost`; overhead = `percent` on
`direct_cost` or `labor_cost`; estimated profit = `percent` on
`estimate_cost_before_profit`. `coefficient` is not accepted for these
components yet, even though the persisted CalculationRule model may support it
generically; M8.3C must not select a candidate the current cost stack cannot
apply safely.

`ruleOrigin` (`normative_sector_average`, `company_individual`,
`contract_agreed`, `statutory`) is provenance, not a ranking. A contractor rule
never beats a sector-average rule by origin. The only way to narrow by origin is
the caller's explicit `restrictToOrigins`. A `contract_agreed` candidate is a
special case: a contractual agreement is never inferred, so such a candidate is
eligible only when the context explicitly opts in by including `contract_agreed`
in `restrictToOrigins`. A lone `contract_agreed` candidate without that opt-in
resolves to `missing`; a `company_individual` candidate alongside it remains
eligible without enabling the contractual rule. When both origins are explicitly
opted in and both otherwise match, the result is `ambiguous`.

The result is `selected` (exactly one eligible candidate, with provenance
preserved), `missing` (zero) or `ambiguous` (more than one). There is no
implicit default, no "latest wins", no newest-source/highest-rate/narrowest-range
tie-break, and no legal interpretation from monitoring. `missing` is distinct
from `not_applicable`: the resolver never converts a missing candidate into a
zero rate or a not-applicable decision.

Procurement/storage limitation: CP L.01.07-2012 defines different investor
rates for ordinary construction/sanitary/electrical materials, equipment and
metal structures, and the current resource model has no confirmed canonical
category classification. M8.3C therefore resolves a category-specific
procurement/storage candidate only when the caller has already supplied the
explicit category; it never guesses a category from a resource name, and it
never applies one rate to all investor materials.

Validation rejects malformed candidates (invalid dates, `validTo` before
`validFrom`, negative or non-decimal values, missing component/origin/
perspective applicability, malformed basis, incompatible component/value-type/
basis combinations, `fixed_amount` without currency, missing explicit
procurement/storage category, and empty provenance references when supplied)
using the M8.3A Decimal helper for numeric checks.

M8.3C does not modify the database, add a rule repository, import official
rates, scrape websites, classify with AI, or add UI. The percentages in its
tests (for example 26.5%, 14.5%, 6%, 2%, 1.2%) are labelled fixtures, not
current universal defaults.

### Gaps between the candidate contract and the persisted `CalculationRule`

The pure `ProfessionalRuleCandidate` model is intentionally richer than the
current `calculation_rules` table. A later persistence milestone must decide how
to store:

- an explicit validity period (`validFrom`/`validTo`); the table has no
  validity columns;
- `estimatePerspective` applicability (investor/contractor/any);
- `workKind` applicability (construction/installation/commissioning/any);
- `ruleOrigin` provenance (sector-average/company/contract-agreed/statutory);
- the `applicabilityDecisionId` link to an M8.2 applicability decision;
- the procurement/storage category/scope and its "any" neutral marker.

The existing table does already carry `ruleType`, `basis`, `valueType`,
`value`, `currency`, `sourceId` and `sourceReference`, which map onto the
candidate's component, basis, value type, value, currency and source provenance.
Persistence is deferred; M8.3C changes no schema.

## M8.3D professional rule definition persistence

M8.3D persists the reusable, curated rule library that feeds M8.3C. It stores
rule *definitions*; it does not apply rules to an estimate. The chain is:

```text
Normative source / company source
    ↓
Applicability review (M8.2) where required
    ↓
professional_rule_definitions   (reusable curated library — M8.3D)
    ↓
M8.3C resolver                  (selected / missing / ambiguous)
    ↓
M8.3B cost stack                (deterministic application)
    ↓
future applied-rule snapshot / materialization (deferred)
```

### Why `calculation_rules` was not reused

`calculation_rules` is bound to a `calculation_context_id`, so it is specific to
one professional estimate. It is therefore the wrong home for a reusable,
cross-estimate rule library. M8.3D leaves `calculation_rules` unchanged; its
future role may be to materialize/preserve the exact rule a concrete calculation
selected and used. That materialization is a later milestone. The new table is
`professional_rule_definitions`.

### Table and database constraints

`professional_rule_definitions` stores organization-owned rows with: source and
optional applicability-decision provenance, name, component, value type, value,
optional currency, calculation basis, validity period, estimate perspective,
work kind, rule origin, optional procurement category, optional source reference
and notes. The row id becomes the M8.3C `candidateId`. Database CHECK
constraints reject any shape M8.3C/M8.3B cannot use, even if application
validation is bypassed:

- component, perspective, work kind and rule origin are restricted to the known
  values; perspective and work kind include the explicit `any`;
- `value >= 0`; `validTo` is null or `>= validFrom`;
- the component/value-type/basis contract mirrors the M8.3C resolver
  (`coefficient` is not representable for any component);
- a `fixed_amount` rule carries a supported currency; any other value type must
  have a null currency (this also closes the percent-with-currency gap);
- a `procurement_storage` row has a non-empty category (which may be `"any"`);
  every other component must not carry a category;
- an official origin (`normative_sector_average`, `statutory`) must carry an
  `applicability_decision_id`;
- name is non-empty and source reference, when present, is non-blank.

`source_id` references `normative_sources` via the organization-safe composite FK
`(source_id, organization_id)` with `ON DELETE RESTRICT`, so a rule can never
reference another organization's source. `applicability_decision_id` references
`normative_applicability_decisions` via the composite FK
`(applicability_decision_id, source_id, organization_id)` (a new unique key was
added on the decisions table to support it), so a linked decision must belong to
the same organization and the same source. A null decision id is allowed.

### Source / applicability integrity (service)

Database FKs cannot prove the *meaning* of a decision, so the service adds
validation: for official origins the referenced applicability decision must
exist for the same organization and source, its `decision` must be `applicable`
(never `not_applicable`, `deferred` or `unknown`), and its window must cover the
rule — `validFrom` not before `applicableFrom`, `validTo` not beyond a finite
`applicableUntil`, and an open-ended `validTo` is invalid when the decision has a
finite `applicableUntil`. Rule origin is never inferred from `sourceType`.
`company_individual` and `contract_agreed` rules may omit the decision link.

### Repository, mapping and governance gate

The dedicated, organization-scoped repository exposes `createRuleDefinition`,
`getRuleDefinition` and `listRuleDefinitionsForComponent`; candidate resolution
never queries `calculation_rules`. A pure mapper turns a definition into a
`ProfessionalRuleCandidate` with `candidateId = definition.id` and
`calculationRuleId = null` (a reusable definition is not an applied
`calculation_rules` row; the two identities are never blurred). Decimal values
stay strings. Loading curated definitions and mapping them is all this layer
does: M8.3C still owns date, perspective, work-kind, currency, category and
origin matching, including the explicit `contract_agreed` opt-in — mapping a
contract-agreed definition does not bypass that gate.

The governance gate for official rules is the linked `applicable` decision, not
`normative_sources.officialStatus` and not monitoring status. For now the exact
linked decision is trusted at creation time; automatic response to a later
governance revision (for example a superseding applicability decision) is
deferred to a future monitoring/orchestration milestone.

### RLS, migration and scope

`professional_rule_definitions` joins the professional RLS policy set with
member SELECT/INSERT/UPDATE and no DELETE, consistent with the professional
history policy; cross-organization access stays blocked. The additive migration
was generated with Drizzle (no destructive rewrite, no backfill of guessed
values). No real Moldovan rate data is seeded in M8.3D; test values are labelled
fixtures. `calculation_rules` and `calculation_contexts` are unchanged — in
particular, `estimatePerspective`, `workKind` and `procurementStorageCategory`
are intentionally not added to `calculation_contexts` yet, because work kind can
vary within one estimate and the permanent scope needs field evidence.

## M8.3E first official rule pack (CP L.01.07-2012)

M8.3E introduces the first real curated Moldovan normative rules into the
pipeline and proves the complete chain end to end:

```text
official normative source        (normative_sources, CP L.01.07-2012)
        ↓
explicit applicability decision  (normative_applicability_decisions, "applicable")
        ↓
curated rule pack                (domain/.../official-rule-packs/cp-l-01-07-2012.ts)
        ↓
professional_rule_definitions    (M8.3D persistence + governance gate)
        ↓
M8.3C resolver                   (selected / missing / ambiguous)
        ↓
M8.3B cost stack                 (deterministic application)
```

It is **not** a general legal-data import system. It materializes only the
verified investor sector-average procurement/storage rates from
CP L.01.07-2012, clauses 3.2 and 3.3(a)/(c):

| Category | Clause | valueType | basis | value | perspective | origin |
| --- | --- | --- | --- | --- | --- | --- |
| `construction_materials` | 3.2, 3.3(a) | percent | material_cost | 2 | investor | normative_sector_average |
| `metal_structures` | 3.2, 3.3(c) | percent | material_cost | 0.75 | investor | normative_sector_average |

Clause 3.2 requires procurement/storage to be a percent of material cost
**excluding transport and VAT**. The cost stack applies the selected rule to
material cost and keeps transport separate, but it cannot currently verify that
arbitrary material prices are VAT-exclusive: `ResourcePrice` has no VAT-basis
provenance. The M8.3E end-to-end scenarios use a material base assumed/known to
be VAT-exclusive; they prove the rule pipeline and arithmetic, not VAT-basis
enforcement for real price data.

### What is deliberately excluded

- **The 1.2% equipment ("utilaje") rate from 3.3(b) is deferred.** The current
  professional model has no explicit, safe equipment-cost base to map the
  normative meaning of *utilaje* to, so it is not guessed. Resolving the
  `equipment` category therefore returns `missing`, not an invented 1.2%.
- **No contractor versions of the 2% / 0.75% rates are created.** Under clauses
  3.4 and 3.5 a contractor normally uses its own individual rates and may use
  these sector averages only by agreement. That belongs to a future, explicitly
  opted-in `contract_agreed` flow, never an inferred default. A contractor
  resolution context does not select these investor definitions.
- **Mixed procurement-category allocation is not implemented.** The cost stack
  applies one selected procurement/storage rule to the single material-cost base
  supplied for the calculation. M8.3E does not split one estimate's material cost
  across `construction_materials`, `equipment` and `metal_structures`, and adds
  no AI classification or category inference. Each category is proven in a
  separate homogeneous scenario.
- **VAT-basis provenance and VAT-exempt-object handling are not implemented.**
  CP L.01.01-2012 distinguishes VAT treatment for legally VAT-exempt objects.
  Automatic real-estimate orchestration must not assume an unknown material
  price is VAT-exclusive; this limitation must be resolved before CP L.01.07 is
  automatically applied to arbitrary resource-price data. M8.3E adds no VAT
  calculation, tax rates or VAT schema.

### Source identity gate and provenance

These percentages are production normative data, not calculation-engine
defaults. They live as explicit, provenance-bearing data in the pack module and
are never hardcoded inside the generic M8.3A/B/C engines.

The installer requires an explicit `organizationId`, `sourceId` and
`applicabilityDecisionId`. It loads the persisted source with the new
organization-scoped `getSource(...)` (no "latest source wins" lookup) and
refuses to attach rules unless the source is the same organization's
`CP L.01.07-2012` / edition `2012`. It never creates or infers an applicability
decision. Each created definition is official and flows through the M8.3D
governance gate, which re-validates the supplied decision (exists, same
organization and source, `applicable`, window covers the rule validity).

### Idempotency

Re-installing the same pack with the same organization, source and applicability
decision reuses the existing exact definitions and creates no duplicates. A
persisted definition occupying the same pack slot (source + applicability
decision + procurement category) with a conflicting value or semantics fails
explicitly with `conflicting_existing_definition`; an official definition is
never mutated to a different rate. No new migration or `calculation_rules` row
is introduced; idempotency is application-level over the persisted definitions.

See `docs/architecture/normative-pack-cp-l-01-07-2012.md` for the full pack note.
