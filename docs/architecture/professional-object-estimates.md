# Professional object estimates (M8.5A)

`professional_object_estimates` aggregate live local professional calculations
for one construction object. The cost category on each entry is an explicit
user selection; it is never inferred from a work kind, norm, resource type, or
description.

Included entries contribute the current
`estimateSubtotalBeforeLimitedCostsAndVat` from the shared professional
calculation service. Subtotals are not persisted, rounded, converted, or
recomputed by a second pricing engine. Organization, object, valuation date,
and currency must match. A missing or incomplete included local calculation
makes the object estimate incomplete. Excluded entries remain persisted for
traceability and do not contribute.

The object estimate is a live aggregation, not an immutable or approved
snapshot. Edits to local quantities, norms, resource prices, rules, or explicit
cost-component decisions change its displayed values on revalidation.
Finalization and immutable professional calculation snapshots belong to a
later milestone.

Changing the local perspective or work kind does not replace or remove saved
explicit component decisions. Temporarily ineligible decisions block the local
and linked object totals; restoring eligibility reactivates the exact saved
rules without reselection or relinking. An absent decision or a saved rule that
remains ineligible still blocks calculation. The context form remounts its
controls when persisted perspective/work-kind values change, keeping the
visible selections synchronized with the server-authoritative context.

VAT, general-estimate chapters 1–12, and Form 8 PDF generation are out of
scope. Form 8 unit indicators are deferred until explicit area, volume, or
length data exists:

> Indicatorii unitari ai Formularului 8 sunt deferiți până când există date
> explicite despre suprafață, volum sau lungime.

Returnable sums are also deferred; the application does not infer them or
represent their absence as zero.
