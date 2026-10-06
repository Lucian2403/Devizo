# Normative Intelligence

Devizo treats legal/normative provenance as part of the professional estimate
domain. The goal is not to turn the application into a legal-news feed. The
goal is to know **which source, edition and validity context supports a
professional calculation**, and to signal when an official source may have
changed.

## Non-negotiable rules

1. A detected website change is a **review signal**, not a legal conclusion.
2. Devizo never changes a calculation rule, norm, resource consumption or price
   automatically because an official page changed.
3. Finalized/historical documents are never recalculated retroactively.
4. Normative documents, norm collections, price catalogs, legislation,
   official guidance and company-specific rules remain distinct source types.
5. Official status (`in_force`, `consultation`, `repealed`, etc.) is separate
   from the internal lifecycle of a Devizo record (`draft`, `active`,
   `superseded`).
6. Provenance is first-class data. Calculation rules already point to a
   `normative_source`; resource prices may now do the same.
7. Monitoring is restricted to an explicit allowlist of official domains.
   This prevents arbitrary URLs from becoming server-side fetch targets.

## Source lifecycle

```text
Official source
    ↓
NormativeSource (code + edition + provenance + validity)
    ↓
Periodic/manual verification
    ↓
Fingerprint unchanged ───────────────→ mark verified
    ↓ changed
NormativeUpdate (detected)
    ↓
Human review
    ├── reviewed
    └── dismissed
```

The `NormativeUpdate` record is deliberately descriptive. It does not contain
an executable formula and cannot mutate a `CalculationRule`.

## Monitoring model

The v1 monitor fetches the configured official HTML page, removes navigation,
scripts, forms and other non-document chrome, normalizes the remaining text,
and stores a SHA-256 fingerprint.

The first successful check establishes a baseline and creates no alert. A later
different fingerprint creates one `source_page_changed` event for that new
fingerprint.

This mechanism is intentionally conservative. It tells the user:

> "The official page is different from the last verified version."

It does **not** tell the user:

> "The law changed and these calculations must now use a new formula."

That second statement requires review and, where applicable, a new versioned
source/rule published into Devizo.

## Moldova baseline

The application can idempotently bootstrap a small curated registry of the
core Moldova `CP L.01.*` sources relevant to the resource method. The baseline
stores metadata and official E-DNC links only; it does not reproduce normative
document contents.

Baseline metadata is versioned in code so changes are reviewable. Importing the
baseline into one organization does not make any calculation automatically
"compliant"; it establishes source identities and provenance anchors.

## User experience

`/normative` is the Normative Intelligence Center. It shows:

- monitored sources and editions;
- official status and effective date;
- last verification state;
- how many professional records currently depend on a source;
- detected source changes requiring human review.

The page also exposes an explicit manual "Verifică sursele oficiale" action.

## Scheduled monitoring

The application exposes:

```text
GET /api/internal/normative-monitor
Authorization: Bearer <CRON_SECRET>
```

An external scheduler may call this endpoint. `CRON_SECRET` is optional; when
it is absent (or empty) the endpoint returns `503` and scheduled monitoring is
disabled.

The scheduler has no session cookie, so this exact path is excluded from the
session-redirect in `infrastructure/supabase/middleware.ts`. The route
authenticates only through the `CRON_SECRET` bearer token (constant-time
comparison); no other `/api/internal/*` path is public.

No hosting-provider-specific cron configuration is committed. Deployment owns
the schedule. The manual UI check continues to work independently.

## Relationship with professional snapshots

The monitor is about **future source awareness**. A finalized professional
calculation snapshot (later M8 slice) must freeze the exact source versions,
resource prices and calculation rules that produced it. Updating or
superseding a source therefore affects future calculation contexts only unless
a user explicitly creates a new calculation/version.

## What this module is not

- not a legal-compliance guarantee;
- not a substitute for a qualified devizier/verifier;
- not an automatic parser of legal formulas;
- not a crawler of arbitrary websites;
- not a mechanism for silently updating old estimates.
