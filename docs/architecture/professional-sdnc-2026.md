# M8.5D2 — SDNC, contribuția anuală pentru normative tehnice în construcții (2026)

**Boundary:** a fiscal contribution, not a normative Chapter 9 percentage and
not the commercial quote's VAT. This component follows the general reserve
screen, but its base is **not** the General Estimate total.

## Legal evidence, 10 November 2026

- [SFS, cota, 45.4.1](https://www.sfs.md/ro/intrebare-baza-de-date-generalizare/488):
  0.5% from eligible annual fixed-capital investments, fiscal 2026.
- [SFS, obiectul și baza, 45.3.1–45.3.2](https://www.sfs.md/ro/intrebare-baza-de-date-generalizare/487):
  new construction and qualifying intervention works with issued building
  permits, not financed from national public budget, and exceptions.
  The basis includes eligible annual spending such as design/prospecting,
  project checking, construction/montage, qualifying machinery and tools
  included in estimates, equipment installation, technical/author supervision.
- [SFS, investitorul datornic, 45.2.1](https://www.sfs.md/ro/intrebare-baza-de-date-generalizare/486):
  excludes personal-use individual houses for one or two families built
  by individual investors.
- [SFS, calcul anual, 45.5.1](https://www.sfs.md/ro/intrebare-baza-de-date-generalizare/489):
  annual calculation based on actual investments during the fiscal year.
- Legal acts: Codul urbanismului și construcțiilor nr. 434/2023, art. 347;
  Legea nr. 329 din 29.12.2025; Legea nr. 153 din 30.07.2026
  (effective 06.08.2026, applied from fiscal year 2026).

Older rules including the historical **50,000 MDL ceiling** must **not** be
applied for the 2026 fiscal period. Earlier fiscal periods and post-2026
periods require a separate versioned legal review. This first release
intentionally blocks those periods instead of guessing.

## Workflow

1. Complete the existing professional General Estimate (Chapters 1–12),
   Chapter 8/9 adjustments and general reserve.
2. In SDNC (2026), explicitly choose "Se aplică" or "Nu se aplică".
3. Applicable: choose *new construction* or *intervention*; explicitly confirm
   a building permit, non-public funding and absence of the personal-house
   exception. Enter **2026 annual eligible investment in MDL** and cite the
   supporting investment accounting/contract record. The amount may differ
   from the project estimate and may be zero. No calculation runs before a
   documented amount is supplied.
4. Not applicable: choose a distinct legal reason and provide a project basis.
   No fictitious zero-value contribution is inferred without the reason.
5. The domain kernel calculates exactly `annualInvestment * 0.005` using
   Decimal, without JS floats, rounding early, or imposing a 50,000 MDL cap.
6. The calculated SDNC appears **separately** after the reserve. It does not
   silently change Chapters 1–12, the reserve, total with reserve or any
   official VAT base. It is not a completed DNTC25 tax return.

## Data integrity and access

- Table `professional_sdnc_decisions`, migration `0029`:
  tenant-scoped estimate FK, unique one decision per estimate, year 2026 and
  pinned legal-version checks, conditional not-null for documented annual
  basis, positive annual base constraint, explicit exclusion reason, required
  notes, access-safe upsert.
- Member-only RLS policies in `0013_professional_sdnc_rls.sql`. No DELETE grant.
- Server action checks org membership; service rejects other estimates and
  fiscal dates outside 2026.
- The annually derived amount is never copied from the general estimate.
- No automation for filing or paying taxes is included.

## Manual acceptance on a **development** database

1. Check that `pnpm db:migrate` and `pnpm db:policies` target the intended
   disposable/development database; never run tests against production.
2. Open the completed Deviz General test used for PR #34. Scroll to SDNC.
3. Select `Se aplică`, choose `Construcție nouă`, confirm the permit,
   nonpublic funding and house exemption check, enter annual base
   `1 000 000 MDL` as `1000000`, and a demonstrative document/reference.
   Expect `5 000 MDL` SDNC in a distinct card.
4. Re-enter `2000000` and save; expect `10000 MDL`, not `15000 MDL`.
   Chapters and reserve must remain unchanged.
5. Try unchecked legal confirmations, empty documents and invalid/negative
   bases. They must be rejected, preserving the last saved result.
6. Select `Nu se aplică`, with a reason and written basis. The 0.5%
   calculation must disappear; the reason remains saved after refresh.
7. A valuation date in 2027 must not auto-use the 2026 rules.

Before client use, confirm legal eligibility with a specialist and the
company's fiscal records. This is an annual contribution estimate, **not** a
replacement for the statutory declaration, remittance or fiscal advice.
