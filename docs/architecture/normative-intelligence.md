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

## M8.2 review, applicability and lineage

The workflow is explicitly:

```text
DETECTED
    ↓
HUMAN REVIEW
    ↓
EXPLICIT APPLICABILITY DECISION
    ↓
VERSIONED NORMATIVE STATE
    ↓
AVAILABLE TO FUTURE CALCULATIONS
```

A detection is never a legal interpretation or an instruction to update
calculation inputs. `normative_updates` remains the detection queue. A separate,
one-per-update `normative_update_reviews` record captures the human decision,
note, reviewer, timestamp, edition identity, evidence URL, known dates, and the
detected/previous fingerprints. Repeated submission of the same review is
idempotent; it does not create a second review record. M8.1 reviews do not have
invented reviewer details: their existing status and timestamp remain visible,
with the missing details identified as unavailable.

Applicability is a separate append-only decision history attached to a
`normative_sources` edition, not a flag on the source or on an estimate norm.
Each decision has a tenant-scoped revision, author, timestamp, required basis
note, evidence URI, optional triggering update, explicit applicability dates,
and snapshots of the source identity/status/fingerprint. Decision values are
`applicable`, `not_applicable`, `deferred`, and `unknown`. An `applicable`
decision requires a human-supplied start date and a source whose recorded
official status is `in_force`; draft, consultation, approved-but-not-yet-
effective, superseded, repealed, and unknown sources cannot be marked
applicable. The database checks this recorded status as well as the date range.
When an applicability decision references a detected update, that update must
already have a human review record.
The application's record lifecycle, official status, monitor verification
state, and applicability decision remain separate concepts.
The applicability history presents the decision, recorded date, responsible
member's name (when available), source status and reason in plain language.
Raw user identifiers and source fingerprints remain available in collapsed
technical audit details; they are not substituted for a person's name.
Dates on non-applicable decisions are labelled as recorded periods, not as
confirmation that the source applies.

`normative_source_relations` stores directional, evidenced relationships such
as `amends`, `replaces`, `supersedes`, `supplements`, `corrigendum_to`, and
`related_to`. A relation never implies that one edition is a full replacement.
Both ends must belong to the same organization; self-links and duplicate
relations are rejected. Restrictive foreign keys and append-only behavior
preserve lineage and its evidence.

`EstimateNormVersion` now has a publication lifecycle (`draft` → `in_review` →
`approved` → `published`). A published version and its resource consumptions
cannot be edited or deleted; a change requires a new version. This lifecycle
does not publish or alter anything as a consequence of monitoring, and M8.2
does not add a norm importer or an authoring interface.

No `NormativePackage`/`NormativeBasis` entity is introduced yet. The exact
meaning of a calculation package, old/new WinSmeta bases, and the composition
of yearly editions are deferred until a real WinSmeta workflow has been
observed. Future finalized calculations must snapshot the exact source,
applicability revision, norm version, consumption, resource-price and rule
inputs used; this milestone does not implement those calculations or snapshots.

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
