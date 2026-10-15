# Professional norm library and assignment manual acceptance

Run this checklist after pulling the feature branch. The sample values below
are technical test data only; they are not official normative values.

## A. Create an internal norm

1. `git pull`
2. `pnpm dev`
3. Open **Devize** → **Biblioteca de norme**.
4. Create:
   - Cod: `TEST-TENC-001`
   - Denumire: `Tencuieli interioare — normă internă de test`
   - Versiune: `1`
   - Bază: `100`
   - UM: `m²`
5. Confirm it is labeled **Normă internă**.

## B. Add resources

6. On the norm detail page add:
   - Cod: `LAB-001`
   - Resursă: `Muncitor constructor`
   - Tip: `labor`
   - UM: `h`
   - Consum / 100 m²: `10`
7. Add:
   - Cod: `MAT-001`
   - Resursă: `Material de test`
   - Tip: `material`
   - UM: `kg`
   - Consum / 100 m²: `3`
8. Add:
   - Cod: `MCH-001`
   - Resursă: `Utilaj de test`
   - Tip: `machinery`
   - UM: `h`
   - Consum / 100 m²: `2`
9. Refresh and confirm all three resources persist.

Zero consumption is accepted because the existing `resource_consumptions`
database constraint allows values greater than or equal to zero. It represents
an explicitly listed resource with no consumption for this norm version and
produces a zero required quantity; it does not create a price or cost.

## C. Assign to an existing estimate

10. Open the M8.4A test estimate.
11. Find the position:
    - Tencuieli interioare
    - 250 m²
12. Click **Alocă normă**.
13. Select `TEST-TENC-001` / version `1`.
14. Confirm the assignment.
15. Expand **Vezi resursele** and verify:
    - Muncitor constructor: `25 h`
    - Material de test: `7,5 kg`
    - Utilaj de test: `5 h`
16. Refresh and confirm the assignment and resources persist.
17. Verify **Cost** is still `—`.
18. Verify the page says **Prețurile resurselor nu sunt încă alocate.**
19. Attempt to assign a second norm to the same position and confirm the
    existing assignment remains unchanged with a clear rejection.

## D. Unit-safety test

20. On the **Structuri metalice** position with unit `kg`, attempt to select the
    `m²` norm.
21. The norm must not be selectable; if submitted directly, the server must
    reject it cleanly.
