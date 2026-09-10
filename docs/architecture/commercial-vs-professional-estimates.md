# Commercial vs Professional Resource-Based Estimates

Devizo contains two **separate bounded contexts** for producing estimates. They
must never be merged, and code in one context must not silently reach into the
other. This document is the authoritative architectural boundary. Any future
work that blurs these two domains is a defect.

There are two distinct meanings of the word "estimate" ("deviz") in the product:

1. **Commercial Estimate / Commercial Offer** — the system that exists today.
2. **Professional Resource-Based Estimate** — a future, additive bounded
   context that does not exist yet.

---

## A. Commercial domain (existing — DO NOT BREAK)

This is the current, shipping system. It is a commercial quotation engine.

### Components that belong to the commercial domain

- Tables: `quotes`, `quote_versions`, `quote_items`, `catalog_categories`,
  `catalog_items`
- Service: `QuoteService` (`domain/quotes/quote.service.ts`)
- Commercial pricing engine: `domain/quotes/pricing.ts`
- Current AI extraction + commercial catalog matching:
  `domain/ai/estimate.service.ts`, `domain/ai/matching.ts`,
  `domain/catalog/item.repository.ts`
- Commercial PDF generation: `lib/pdf/*`
- Discounts, VAT, customer-facing commercial terms
- Immutable commercial quote versions and their frozen snapshots

### Canonical meaning

> **A commercial estimate is a Commercial Offer / Commercial Estimate.**

A **commercial unit price** is either an explicit company catalog price or an
explicit manual price entered by the user. It is **NOT** derived from
professional construction norms. Quantity × unit price, discounts and VAT are
deterministic and calculated only by application code (`pricing.ts`). The LLM is
never authoritative for money.

---

## B. Professional estimate domain (future — NOT YET BUILT)

This is a **new** bounded context. It does not share models or persistence with
the commercial domain. **Do not build its database schema in this milestone.**

### Reserved concepts (new domain models, new persistence)

- `ConstructionObject`
- `WorkQuantityList`
- `WorkItem`
- `EstimateNorm`
- `EstimateNormVersion`
- `Resource`
- `ResourceConsumption`
- `ResourcePrice`
- `NormApplication`
- `CalculationContext`
- `CalculationRule`
- professional estimate calculation snapshot

### Canonical meaning

> A **professional unit price** must ultimately be **DERIVED deterministically**
> from norms, normative resource consumptions, current resource prices and
> calculation rules.

It must **never** simply reuse `catalog_items.selling_price`. Professional
source data and regulatory/normative data must preserve **provenance and
versioning**.

---

## Architectural invariants (explicit non-equivalences)

These are hard invariants. Treat any code that violates them as a bug:

- `catalog_item != estimate_norm`
- `catalog_item != professional_resource`
- `quote_item != professional_work_item`
- `selling_price != norm-derived unit price`
- `Project != necessarily ConstructionObject`
- a commercial `QuoteVersion` is **not** a professional estimate calculation
  snapshot

---

## Migration boundaries

- Existing commercial quote data is retained **as-is**.
- Finalized commercial versions are **never** recalculated using the future
  professional engine.
- The future professional tables will be **additive**. No existing tables are
  renamed, dropped or repurposed.
- Any future relationship between a commercial `catalog_item` and a
  norm/resource must be an **explicit, optional mapping** — never an implicit
  identity.
- **No automatic semantic migration** from commercial catalog data into
  professional norm/resource data is allowed. Commercial catalog items are not
  norms and not resources.

---

## AI position (both domains)

AI remains **non-authoritative for all monetary calculations** in both domains.
AI may transcribe, extract, classify, and suggest matches. Deterministic
application code owns every number that appears on a document. In the
professional domain, calculations must additionally be reproducible from
versioned norm/resource data.
