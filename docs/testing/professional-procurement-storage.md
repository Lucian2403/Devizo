# M8.4D procurement/storage manual acceptance

Use technical test data only. Do not seed official work norms or create fake
production rule definitions for this checklist.

## Setup

1. Pull `feature/professional-procurement-storage-v1`.
2. Configure the normal local application environment.
3. Run `pnpm db:migrate`. Migration `0019_puzzling_vampiro` is additive:
   existing context/category values remain null, existing price semantics become
   unknown/unknown. Do not backfill classifications from assumptions.
4. Run `pnpm db:policies` only if required by the normal project setup. This
   milestone does not change RLS or add delete policies.
5. Run `pnpm dev`.
6. Ensure the verified CP L.01.07-2012 source, applicable decision and official
   investor rule pack are already installed through the existing normative UI.
   M8.4D does not install or select sources automatically.

## Existing 275 m² estimate

7. Open the professional estimate with `Tencuieli interioare`, `275 m²`,
   `TEST-TENC-001`, basis `100 m²` and valuation date on/after `2012-08-17`.
8. Under **Context de calcul**, explicitly save:
   **Deviz investitor**, **Construcții**.
9. In **Devize → Resurse și prețuri → MAT-001**, set **Categoria
   aprovizionare-depozitare → Materiale de construcții** and save.
10. On the existing selected `1200 MDL / 100 kg` price, open **Clasifică
    prețul**, choose **TVA în preț → Fără TVA** and **Transport în preț →
    Fără transport**, then save. Make these declarations only for the technical
    test price. Verify price, basis, currency, dates and provenance did not change.
11. Return to the estimate and expand its resources. Direct costs remain:
    labor `2 750 MDL`, material `99 MDL`, machinery `1 375 MDL`;
    direct resources `4 224 MDL`.
12. Under **Costuri normative → Aprovizionare-depozitare** verify:
    - Materiale de construcții, eligible base `99 MDL`.
    - Selected persisted rule `2%`.
    - Source `CP L.01.07-2012, pct. 3.2, 3.3(a)`.
    - Procurement/storage `1,98 MDL`.
    - **Cost direct + aprovizionare-depozitare: 4 225,98 MDL**.
13. Expand **Proveniența calculului**. Verify rule definition/source/
    applicability-decision IDs, origin, category, material resource/consumption/
    price IDs and material contribution. Context perspective, work kind and
    valuation date must be visible.
14. Refresh. The result is recalculated from saved inputs, not saved amounts.
    **Calcul profesional** must not be marked complete.

## Safety

15. Change the existing material price's VAT treatment to **Necunoscut**.
    Verify an explicit semantics block, no procurement amount for that material,
    and no combined intermediate amount. Restore **Fără TVA**.
16. Repeat with transport **Necunoscut**, then restore **Fără transport**.
17. Change perspective to **Deviz antreprenor**. With only the investor pack
    installed, verify **Nu există o regulă eligibilă pentru categorie și
    context**, no procurement amount, and no combined amount. Restore investor.
18. Clear the material category. Verify explicit unclassified status and no
    category inference. Restore construction materials.
19. Select equipment or other. Without an explicit compatible persisted rule,
    resolution is missing. There is no 1.2% equipment fallback. Restore category.
20. On a separate test estimate dated before `2012-08-17`, supply valid prices
    for that date and configured context/category/semantics. The pack must
    resolve missing; today's date or price creation date must not override it.
21. An empty norm composition remains incomplete. Existing zero-quantity
    resource rows remain valid zero contributions.
22. Verify missing/ambiguous resource prices still block their material base.
    Do not create fake production rules to test ambiguity; automated fixtures
    cover overlapping rules and separate construction/metal bases.

No overhead, profit, labor contributions, material transport calculation, VAT,
final estimate totals/forms, or immutable calculation snapshot is expected.

## Database test safety

`pnpm test:normative:db` requires an **empty disposable PostgreSQL 16 + pgvector
database**, `DATABASE_TEST_URL` distinct from the application URL, and
`CONFIRM_DISPOSABLE_DATABASE=yes`. It applies the pre-M8.4D migration chain,
inserts old-format fixtures, applies the new migration, and verifies safe
defaults, CHECK constraints and organization RLS. Never run it against the
normal application database.
