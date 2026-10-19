# Professional resource prices and direct resource cost

This checklist validates M8.4C. Resource prices are professional resource
records, separate from commercial catalog prices. A calculated amount is the
**direct resource cost** only; it is not a final estimate value. No prices are
seeded automatically.

## Manual acceptance

1. Pull the feature branch and start the app with `pnpm dev`.
2. Open **Devize → Resurse și prețuri**.
3. Open the existing test resources `LAB-001`, `MAT-001`, and `MCH-001`.
4. Add these explicitly technical test prices (not official values), with
   `validFrom` on or before the estimate valuation date and source type
   `Manual`:

   | Resource | Price | Basis quantity | Currency |
   | --- | ---: | ---: | --- |
   | LAB-001 | 100 | 1 h | MDL |
   | MAT-001 | 1200 | 100 kg | MDL |
   | MCH-001 | 250 | 1 h | MDL |

   Since M8.4D, explicitly select **TVA în preț** and **Transport în preț**
   when creating each price; unknown is a valid declaration. These fields do
   not change the direct-cost arithmetic. For the normative material base and
   required migration, follow the [procurement/storage checklist](professional-procurement-storage.md).

5. Open the existing professional estimate with `Tencuieli interioare`,
   quantity `275 m²`, and norm `TEST-TENC-001` (basis `100 m²`).
6. Expand **Vezi resursele** and verify the resource lines show:

   | Resource | Required quantity | Displayed price | Effective price | Cost |
   | --- | ---: | ---: | ---: | ---: |
   | LAB-001 | 27,5 h | 100 MDL / 1 h | 100 MDL / h | 2 750 MDL |
   | MAT-001 | 8,25 kg | 1 200 MDL / 100 kg | 12 MDL / kg | 99 MDL |
   | MCH-001 | 5,5 h | 250 MDL / 1 h | 250 MDL / h | 1 375 MDL |

7. Confirm the position cost is **4 224 MDL**, labeled **Cost direct
   resurse**, and the resource-type subtotals are labor `2 750 MDL`, materials
   `99 MDL`, and machinery `1 375 MDL`.
8. Refresh the estimate and confirm the amount is recalculated from the saved
   work quantity, norm application, resource consumptions, and resource prices.
   No derived cost total is persisted.
9. For a resource with no eligible price, confirm **Cost = —**,
   **Prețuri incomplete**, and the message that there is no price in the
   estimate currency valid on the valuation date. Known, priced resource lines
   should remain visible.
10. Add a second overlapping price for a required resource. Confirm its status
    is ambiguous with both eligible records counted, and no cost is selected.
11. Add only an EUR price for a resource required by an MDL estimate. Confirm
    the EUR price does not satisfy the MDL requirement.
12. If a norm has a resource whose required quantity is exactly zero, confirm
    it displays that no price is required and contributes zero without a
    fabricated price record.

## Closing an old price's validity

Price records are never deleted and their value/provenance is not rewritten.
On resource detail, **Închide valabilitatea** accepts only **Valabil până la**.
For a closed record, **Modifică data de încheiere** corrects that same date.
The required calendar date cannot precede the saved start date. This action
updates only `resource_prices.valid_to`, separately from VAT/transport
classification, and revalidates the resource register and estimate layout.
No new migration or RLS change is needed.

Application date displays and date-entry fields use `DD-Mmm-YYYY`, for example
`19-Oct-2026`, with fixed English month abbreviations. Text fields validate real
calendar dates and submit ISO `YYYY-MM-DD` values to the existing server
validators; storage, calculations and inclusive boundaries are unchanged.
Customer PDFs retain their frozen template's date formatting.

With two MDL prices starting `2026-10-01` and `2026-10-19`, both open-ended,
an estimate dated `2026-10-19` is ambiguous. Close the first at `2026-10-18`:
the second alone must be selected on `2026-10-19`, while the first remains
eligible on the inclusive closing date `2026-10-18`. Verify both records remain
visible and their amounts, bases, currency, provenance and VAT/transport
classifications are unchanged. Correct the closing date and verify it persists.
An earlier-than-start or invalid date must produce a Romanian error without
changing the record.

## Automated verification

Run the professional estimate, normative, normative database, type-check,
responsive UI, and changed-file lint checks listed in the implementation
report. No database migration or RLS change is part of this milestone.
