# M8.4E professional cost-stack decisions

## Manual acceptance

1. Open **Devize → Reguli de calcul**.
2. Create the technical test rules below. These are acceptance fixtures only,
   not recommended or official rates:
   - labor contributions: 5%, `labor_cost`, investor, construction;
   - material transport: 10%, `material_cost`, investor, construction;
   - overhead: 10%, explicitly choose `direct_cost`, investor, construction;
   - estimated profit: 5%, `estimate_cost_before_profit`, investor, construction.
3. Open the existing one-position acceptance estimate. Confirm investor,
   construction, raw resources of 4 224 MDL and CP L.01.07 procurement/storage
   of 1.98 MDL.
4. Explicitly select **Aplică această regulă** for each remaining component.
5. Verify the exact, unrounded professional subtotal:

   | Component | Expected |
   | --- | ---: |
   | Resource cost | 4 224 MDL |
   | Labor contributions | 137.5 MDL |
   | Material transport | 9.9 MDL |
   | Procurement/storage | 1.98 MDL |
   | Direct cost | 4 373.38 MDL |
   | Overhead | 437.338 MDL |
   | Cost before profit | 4 810.718 MDL |
   | Estimated profit | 240.5359 MDL |
   | Subtotal before VAT | 5 051.2539 MDL |

6. Change a component to **Marchează ca neaplicabilă**, enter a reason, and
   confirm the stack retains that reason and recalculates with an explicit
   not-applicable decision.
7. Change the context perspective to contractor. Investor-only saved rules
   must be shown as stale and the professional calculation must be incomplete
   until eligible rules are explicitly selected or components explicitly marked
   not applicable.
8. Restore investor perspective, add an overlapping eligible rule, and confirm
   ambiguity is shown without automatic selection.
9. When labor or material base is exactly zero, verify `zero_basis` is shown
   separately and no rule or decision is fabricated.

This milestone reports a subtotal before VAT and other limited/final costs. It
does not calculate VAT, final payable amounts, or F1/F3/F5/F7 forms.

## Database verification

`pnpm test:normative:db` applies migrations and the RLS policies to a disposable
PostgreSQL 16 database with pgvector, then verifies decision checks, composite
organization relationships, unique context/component decisions, and RLS
isolation. Never point `DATABASE_TEST_URL` at the application database.
