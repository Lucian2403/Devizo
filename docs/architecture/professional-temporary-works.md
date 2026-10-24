# Professional temporary works (M8.5C1)

M8.5C1 adds the first normative cost applied at general-estimate level:
temporary buildings and special temporary structures under NCM L.02.05-2012.

The calculation remains layered:

local professional estimate
→ object estimate
→ base general-estimate aggregation
→ temporary-works adjustment
→ adjusted chapters 1–12 subtotal

The local and object-estimate money engines are not duplicated.

## Normative percentage path

For an explicitly selected NCM L.02.05-2012 table row, the base is the sum of
construction and installation works in general-estimate chapters 1–7. Chapter 8
never enters its own base.

The selected project condition supplies the normative coefficient:

- standard: 1
- reconstruction/extension at an operating facility: 0.8
- road reconstruction: 0.8
- complex capital repair: 1
- selective capital repair: 0.5

No arbitrary coefficient input is accepted.

The calculated construction and installation amounts are added to Chapter 8.
Equipment and other-cost columns are unchanged.

## Project-calculation path

For a construction type absent from the NCM table, section 1.5 is represented
as a separate explicit mode. The user enters the construction and installation
amounts from the project calculation and a mandatory project reference. No
percentage or project-condition coefficient is applied.

The row "other production branches" is not a generic fallback.

## Governance

The NCM L.02.05-2012 source must already exist in the organization's normative
registry and must match the exact 2012 in-force identity. A human applicability
decision is required. Installing the pack never creates or changes a normative
source or applicability decision.

The pack contains 47 explicit rows, including distinct subrows 20A/20B,
21A/21B, 33A/33B, 34A/34B/34C and 37A/37B/37C. A pack row has one stable
identity per organization + normative source + component + rule code. A newer
explicit applicability revision does not create another copy of the 47 rows:
the existing stable rule ids are reused and their governance provenance is
rebound to the explicitly selected decision. Conflicting normative content is
still rejected rather than overwritten.

A general estimate stores the exact selected rule id and project condition.
If that rule later becomes ineligible, the adjusted calculation becomes
incomplete. Devizo does not silently select another rule.

## Anti-double-counting

Temporary works outside the title list are already covered by overhead under
NCM L.02.05-2012 section 3.3 and are not added automatically here.

Project-specific costs under section 3.4 remain deferred.

Complex non-typical temporary structures that have their own object estimates
are not duplicated through this percentage adjustment.

## Recoverable amount

The 15% recoverable amount from section 4.5 is calculated and displayed
separately. M8.5C1 does not subtract it from the chapters 1–12 subtotal.

## Deferred

Winter-condition costs, section 3.4 project-specific rows, reserve, SDNC, VAT,
Form 9 and professional finalization remain outside this milestone.
