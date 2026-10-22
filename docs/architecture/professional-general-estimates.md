# Professional general estimates (M8.5B)

A professional general estimate is a live top-level container over explicitly
associated professional object estimates. It does not require those source
estimates to share a construction object. Each association explicitly selects
one of the twelve base NCM L.01.01-2012 chapters and receives a stable
chapter-local row number (`chapter-position`).

The calculation service consumes only the current four-column totals returned
by the professional object-estimate service. It does not recalculate local
resource costs, convert currencies, or round intermediate values. All included
sources must be complete and match the general estimate's exact valuation date
and currency. Excluded associations remain stored and visible for traceability
but do not contribute to totals or completion.

The displayed result is only the subtotal for chapters 1–12. Chapter 8 and 9
normative additional costs, beneficiary services, design/prospecting,
unforeseen-cost reserve, SDNC financing, VAT, returnable sums, Form 9,
finalization, and approval are not calculated here. Zero in an empty chapter
means only that there are no included rows in that chapter; it is not a legal
determination that a cost is inapplicable.

The chapter labels are the base NCM L.01.01-2012 nomenclature. Sector-specific
alternative nomenclature is deferred. All values remain live: changes to local
calculations propagate through object estimates into general estimates on
revalidation. No professional snapshot or finalized amount is created.

An empty pure aggregate is rejected rather than assigned zero totals or an
implicit currency. Only empty chapters within a valid non-empty aggregate have
zero totals. Chapter-edit controls remount when the persisted entry chapter
changes, keeping the visible selection synchronized with the server.
