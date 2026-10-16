# Professional estimate workspace manual acceptance

Run this checklist after pulling the feature branch:

1. `git pull`
2. `pnpm dev`
3. Click **Devize** in the top navigation.
4. Confirm the empty state or the current estimate list renders.
5. Click **Deviz profesional nou**.
6. Create an estimate with:
   - Denumire deviz: `Test deviz resurse`
   - Obiect: `Renovare apartament test`
   - Lista: `Lista de cantități principală`
   - Data evaluării: current test date
   - Moneda: `MDL`
7. Confirm the app redirects to the estimate detail page.
8. Confirm the header shows the object, list, revision 1, valuation date, MDL,
   and resource method.
9. Add position 1:
   - Poz: `1`
   - Cod: `TEST-001`
   - Lucrare: `Tencuieli interioare`
   - UM: `m²`
   - Cantitate: `250`
10. Confirm the row offers **Alocă normă**, displays **Cost = —**, and says
    resource prices have not been assigned.
11. Add position 2:
    - Poz: `2`
    - Cod: `TEST-002`
    - Lucrare: `Structuri metalice`
    - UM: `kg`
    - Cantitate: `1250.5`
12. Confirm the quantity displays in human-friendly form, e.g. `1250,5`.
13. Edit position 1 quantity from `250` to `275.25`.
14. Refresh and confirm the changed quantity persists.
15. Attempt to add a duplicate position number and confirm the form displays a
    clear validation error.
16. Refresh and confirm both positions remain.
17. Return to `/professional-estimates` and confirm the estimate appears with
    two positions, the correct date, and the correct currency.

No manual cost calculation is expected in this milestone.

For internal norm creation, resource composition, norm assignment, and
resource-quantity checks, follow
[professional-norm-assignment.md](./professional-norm-assignment.md).
