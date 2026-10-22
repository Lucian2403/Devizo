# Professional general estimate acceptance (M8.5B)

Run `pnpm db:migrate`, `pnpm db:policies`, then `pnpm dev`.

1. Open **Devize generale** from the professional-estimate workspace.
2. Create `Deviz general test` for valuation date `15-Oct-2026` in `MDL`.
3. Associate `Deviz pe obiect test`, explicitly selecting Chapter 2 —
   `Obiectivul investiții de bază`.
4. Confirm the row is `2-1` and shows the current object-estimate totals:
   construction `5051.2539 MDL`, all other categories `0 MDL`.
5. Confirm Chapter 2 and the **Subtotal capitolele 1–12** both equal
   `5051.2539 MDL`; no VAT or final general-estimate value is shown.
6. Refresh and confirm the association, chapter, and position persist.
7. Exclude the source and confirm the general estimate is incomplete with no
   valid zero subtotal. Include it again and confirm the subtotal returns.
8. Move the source from Chapter 2 to Chapter 7 and back. Confirm chapter-local
   numbering is retained/allocated and the overall subtotal is unchanged.
   After moving to Chapter 7, confirm the row is `7-1`, the chapter column is
   `Capitolul 7`, and the dropdown visibly selects Chapter 7. After moving back,
   confirm both the chapter column and dropdown visibly show Chapter 2 without
   refreshing or reselecting the chapter.
9. Change the underlying local calculation from Investor to Contractor and
   confirm the object and general estimates become incomplete. Restore
   Investor without relinking or reselection and confirm the Chapter 2 and
   overall subtotal return to `5051.2539 MDL`.
10. Confirm included sources with a different valuation date or currency cannot
    be associated; an incomplete but otherwise eligible source can be linked
    and makes the general estimate incomplete.

The 12 labels are the base NCM L.01.01-2012 structure. Sector-specific
nomenclature, chapter 8–12 calculations, reserve, SDNC, VAT, Form 9, and
finalization remain deferred.
