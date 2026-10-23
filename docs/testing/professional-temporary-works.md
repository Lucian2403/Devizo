# M8.5C1 manual acceptance

Run:

```
pnpm db:migrate
pnpm db:policies
pnpm dev
```

Use the accepted general estimate with a base source subtotal of
`5051.2539 MDL`.

1. Open the general estimate. Confirm the source subtotal is still
   `5051.2539 MDL`.
2. In **Clădiri și construcții speciale provizorii**, verify the exact
   NCM L.02.05-2012 source and select an explicit applicable governance decision.
3. Install/verify the pack. Expected: 47 rules; a second install creates 0 and
   reuses all 47.
4. Select technical fixture row **025** (0.8%) and condition **Standard** (K=1).
5. Save. Expected:
   - chapters 1–7 construction base: 5051.2539
   - installation base: 0
   - temporary construction: 40.4100312
   - temporary installation: 0
   - temporary total: 40.4100312
   - recoverable 15%: 6.06150468
   - adjusted Chapter 8 construction: +40.4100312
   - adjusted chapters 1–12 subtotal: 5091.6639312
6. Refresh. The exact rule and condition must persist.
7. Change the condition to reconstruction/extension. Expected temporary total:
   32.32802496 and adjusted subtotal 5083.58192496.
8. Restore Standard. Expected adjusted subtotal: 5091.6639312.
9. Change the underlying local context Investor → Contractor. The source general
   estimate, temporary works and adjusted subtotal must become incomplete.
10. Restore Contractor → Investor without reselecting local rules, object links,
    general chapter, temporary rule or condition. Expected automatic recovery to
    5051.2539 base + 40.4100312 temporary = 5091.6639312 adjusted.
11. Switch to **calcul conform proiectului**, enter construction 100,
    installation 25 and reference `POS test / calcul tehnic`. Expected
    temporary total 125 and adjusted subtotal 5176.2539.

The 15% recoverable amount is informational/provenance in this milestone and
must not reduce the adjusted subtotal.
