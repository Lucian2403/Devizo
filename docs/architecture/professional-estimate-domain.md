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

M8.2 deliberately does not define a normative package/basis composition, the
meaning of old/new WinSmeta bases, annual update behavior, coefficients, or
professional forms. Those decisions require observation of the real workflow.
When professional calculation snapshots are implemented, they must preserve
the exact source identity and evidence, applicability revision, norm version,
resource consumptions, price records and rule inputs used at the valuation
date. Source monitoring and later decisions must never rewrite a historical
snapshot.
