import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getNormativeGovernanceService,
  getNormativeIntelligenceService,
} from "@/server/container";
import { SubmitButton } from "@/components/ui/submit-button";
import { GovernanceForm } from "./governance-form";
import {
  bootstrapMoldovaSources,
  decideNormativeApplicability,
  relateNormativeSources,
  reviewNormativeUpdate,
  verifyNormativeSources,
} from "./actions";

const OFFICIAL_STATUS_LABELS: Record<string, string> = {
  draft: "Proiect",
  consultation: "În consultare",
  approved: "Aprobat",
  in_force: "În vigoare",
  superseded: "Înlocuit",
  repealed: "Abrogat",
  unknown: "Necunoscut",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  normative_document: "Normativ",
  norm_collection: "Colecție de norme",
  price_catalog: "Catalog de prețuri",
  legislation: "Legislație",
  official_guidance: "Ghid oficial",
  company_custom: "Regulă companie",
  import: "Import",
};

const APPLICABILITY_LABELS: Record<string, string> = {
  applicable: "Aplicabilă",
  not_applicable: "Neaplicabilă",
  deferred: "Amânată",
  unknown: "Aplicabilitate nedeterminată",
};

const REVIEW_DECISION_LABELS: Record<string, string> = {
  reviewed_no_action: "Analizat — fără acțiune",
  dismissed: "Respins",
  requires_normative_version: "Necesită ediție normativă nouă",
  requires_metadata_update: "Necesită actualizarea metadatelor",
  requires_follow_up: "Necesită urmărire",
};

const RELATION_LABELS: Record<string, string> = {
  amends: "modifică",
  replaces: "înlocuiește",
  supersedes: "preia locul",
  supplements: "completează",
  corrigendum_to: "rectifică",
  related_to: "este asociată cu",
};

function applicabilityClass(decision: string): string {
  if (decision === "applicable") return "bg-status-ok-bg text-status-ok-fg";
  if (decision === "not_applicable") {
    return "bg-status-neutral-bg text-status-neutral-fg";
  }
  return "bg-status-warn-bg text-status-warn-fg";
}

function officialStatusClass(status: string): string {
  if (status === "in_force") {
    return "bg-status-ok-bg text-status-ok-fg";
  }
  if (status === "draft" || status === "consultation" || status === "approved") {
    return "bg-status-warn-bg text-status-warn-fg";
  }
  if (status === "repealed") {
    return "bg-status-error-bg text-status-error-fg";
  }
  return "bg-status-neutral-bg text-status-neutral-fg";
}

function verificationClass(status: string): string {
  if (status === "success") return "text-status-ok-fg";
  if (status === "error") return "text-status-error-fg";
  return "text-muted-foreground";
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("ro-MD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function usageTotal(usage: {
  normVersions: number;
  resources: number;
  resourcePrices: number;
  calculationRules: number;
}): number {
  return (
    usage.normVersions +
    usage.resources +
    usage.resourcePrices +
    usage.calculationRules
  );
}

function updateStatusClass(status: string): string {
  return status === "detected"
    ? "bg-status-warn-bg text-status-warn-fg"
    : "bg-status-neutral-bg text-status-neutral-fg";
}

export default async function NormativePage() {
  const { org } = await requireCurrentOrg();
  const [overview, governance] = await Promise.all([
    getNormativeIntelligenceService().getOverview(org.id),
    getNormativeGovernanceService().getOverview(org.id),
  ]);
  const applicabilityBySource = new Map<
    string,
    typeof governance.applicability
  >();
  for (const decision of governance.applicability) {
    const history = applicabilityBySource.get(decision.sourceId) ?? [];
    history.push(decision);
    applicabilityBySource.set(decision.sourceId, history);
  }
  const reviewsByUpdate = new Map(
    governance.reviews.map((review) => [review.updateId, review]),
  );
  const updatesBySource = new Map<string, typeof overview.updates>();
  for (const update of overview.updates) {
    const sourceUpdates = updatesBySource.get(update.sourceId) ?? [];
    sourceUpdates.push(update);
    updatesBySource.set(update.sourceId, sourceUpdates);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Fundație profesională
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-heading">
            Bază normativă
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Sursele, edițiile și perioadele de valabilitate folosite de motorul
            profesional Devizo. O modificare detectată nu schimbă automat
            niciun calcul profesional sau nicio regulă de calcul.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={bootstrapMoldovaSources}>
            <SubmitButton variant="outline" pendingLabel="Se încarcă…">
              {overview.sources.length === 0
                ? "Încarcă baza Moldova"
                : "Actualizează metadatele Moldova"}
            </SubmitButton>
          </form>
          <form action={verifyNormativeSources}>
            <SubmitButton
              disabled={overview.stats.monitoredSources === 0}
              pendingLabel="Se verifică sursele…"
            >
              Verifică sursele oficiale
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-status-warn-bg px-4 py-3 text-sm text-status-warn-fg">
        <strong>Este necesară verificarea înainte de aplicare.</strong> Monitorizarea compară
        conținutul paginilor oficiale și semnalează schimbări. Nu declară singură
        că o normă juridică s-a modificat și nu actualizează retroactiv calcule,
        reguli sau documente finalizate.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Surse urmărite
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {overview.stats.monitoredSources}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            În vigoare
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {overview.stats.inForceSources}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Necesită verificare
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {overview.stats.pendingReview}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Erori monitorizare
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {overview.stats.verificationErrors}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">
            Surse și ediții
          </h2>
          <p className="text-sm text-muted-foreground">
            Statutul oficial este păstrat separat de statutul intern al
            înregistrării Devizo.
          </p>
        </div>

        {overview.sources.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="font-medium text-heading">
              Nu există încă surse normative configurate.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Încarcă baza Moldova pentru a porni registrul cu sursele oficiale
              de bază folosite în devizare.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="bg-muted-section text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Sursă</th>
                    <th className="px-4 py-3 font-medium">Ediție</th>
                    <th className="px-4 py-3 font-medium">Tip</th>
                    <th className="px-4 py-3 font-medium">Statut oficial</th>
                    <th className="px-4 py-3 font-medium">
                      Decizie de aplicabilitate
                    </th>
                    <th className="px-4 py-3 font-medium">Monitorizare</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Impact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overview.sources.map((source) => {
                    const affected = usageTotal(source.usage);
                    return (
                      <tr key={source.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-heading">
                            {source.code}
                          </div>
                          <div className="mt-0.5 max-w-md text-muted-foreground">
                            {source.title}
                          </div>
                          {source.sourceUri ? (
                            <a
                              className="mt-1 inline-block text-xs font-medium text-primary-hover hover:underline"
                              href={source.sourceUri}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Sursa oficială ↗
                            </a>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {source.edition}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-secondary-foreground">
                          {SOURCE_TYPE_LABELS[source.sourceType] ??
                            source.sourceType}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              "inline-flex rounded-full px-2 py-1 text-[11px] font-medium " +
                              officialStatusClass(source.officialStatus)
                            }
                          >
                            {OFFICIAL_STATUS_LABELS[source.officialStatus] ??
                              source.officialStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const history =
                              applicabilityBySource.get(source.id) ?? [];
                            const latest = history[0];
                            const sourceUpdates =
                              (updatesBySource.get(source.id) ?? []).filter(
                                (update) => reviewsByUpdate.has(update.id),
                              );
                            return (
                              <div className="min-w-64 space-y-2">
                                {latest ? (
                                  <>
                                    <span
                                      className={
                                        "inline-flex rounded-full px-2 py-1 text-[11px] font-medium " +
                                        applicabilityClass(latest.decision)
                                      }
                                    >
                                      {APPLICABILITY_LABELS[latest.decision] ??
                                        latest.decision}
                                    </span>
                                    <div className="text-xs text-muted-foreground">
                                      Revizia {latest.revision}
                                      {latest.applicableFrom
                                        ? ` · de la ${formatDate(latest.applicableFrom)}`
                                        : ""}
                                      {latest.applicableUntil
                                        ? ` până la ${formatDate(latest.applicableUntil)}`
                                        : ""}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Fără decizie înregistrată
                                  </span>
                                )}
                                <details className="text-xs">
                                  <summary className="cursor-pointer font-medium text-primary-hover">
                                    Istoric și decizie
                                  </summary>
                                  <div className="mt-2 space-y-3 rounded-md border p-3">
                                    {history.map((entry) => (
                                      <div
                                        key={entry.id}
                                        className="border-b pb-2 last:border-0 last:pb-0"
                                      >
                                        <div className="font-medium">
                                          {APPLICABILITY_LABELS[entry.decision] ??
                                            entry.decision}
                                        </div>
                                        <div className="mt-1 text-muted-foreground">
                                          Înregistrată la {formatDate(entry.decidedAt)}
                                          {" · decizia nr. "}{entry.revision}
                                        </div>
                                        {entry.applicableFrom || entry.applicableUntil ? (
                                          <p className="mt-1 text-muted-foreground">
                                            {entry.decision === "applicable"
                                              ? "Perioada de aplicabilitate: "
                                              : "Perioada înregistrată: "}
                                            {entry.applicableFrom
                                              ? `de la ${formatDate(entry.applicableFrom)}`
                                              : ""}
                                            {entry.applicableFrom && entry.applicableUntil ? " " : ""}
                                            {entry.applicableUntil
                                              ? `până la ${formatDate(entry.applicableUntil)}`
                                              : ""}
                                          </p>
                                        ) : null}
                                        <p className="mt-1 text-muted-foreground">
                                          Responsabil:{" "}
                                          {entry.decidedByName?.trim() ||
                                            "Membru al companiei"}
                                        </p>
                                        <p className="mt-1 text-muted-foreground">
                                          Statutul sursei la momentul deciziei:{" "}
                                          {OFFICIAL_STATUS_LABELS[
                                            entry.officialStatus
                                          ] ?? entry.officialStatus}
                                        </p>
                                        <p className="mt-2 whitespace-pre-wrap break-words">
                                          <span className="font-medium">Motivul deciziei: </span>
                                          {entry.basisNote}
                                        </p>
                                        {entry.evidenceUri ? (
                                          <a
                                            className="mt-1 inline-block text-primary-hover hover:underline"
                                            href={entry.evidenceUri}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Consultă dovada deciziei ↗
                                          </a>
                                        ) : null}
                                        <details className="mt-2 text-muted-foreground">
                                          <summary className="cursor-pointer">
                                            Detalii tehnice pentru audit
                                          </summary>
                                          <dl className="mt-2 space-y-2">
                                            <div>
                                              <dt className="font-medium">Sursa la momentul deciziei</dt>
                                              <dd className="break-words">
                                                {entry.sourceCode} · {entry.sourceEdition}
                                                {entry.sourceTitle ? ` · ${entry.sourceTitle}` : ""}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="font-medium">Emitent și jurisdicție</dt>
                                              <dd className="break-words">
                                                {entry.sourcePublisher ?? "Emitent neînregistrat"}
                                                {" · "}
                                                {entry.sourceJurisdiction ?? "Jurisdicție neînregistrată"}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="font-medium">Autoritatea sursei</dt>
                                              <dd className="break-words">{entry.sourceAuthority ?? "Neînregistrată"}</dd>
                                            </div>
                                            {entry.sourceUri ? (
                                              <div>
                                                <dt className="font-medium">Adresa sursei la momentul deciziei</dt>
                                                <dd className="break-all">
                                                  <a href={entry.sourceUri} target="_blank" rel="noreferrer" className="hover:underline">
                                                    {entry.sourceUri}
                                                  </a>
                                                </dd>
                                              </div>
                                            ) : null}
                                            <div>
                                              <dt className="font-medium">Identificatorul responsabilului</dt>
                                              <dd className="break-all">{entry.decidedByUserId}</dd>
                                            </div>
                                            <div>
                                              <dt className="font-medium">Amprenta conținutului sursei</dt>
                                              <dd className="break-all">
                                                {entry.sourceFingerprint ?? "Nu era disponibilă la momentul deciziei"}
                                              </dd>
                                            </div>
                                          </dl>
                                        </details>
                                      </div>
                                    ))}
                                    <GovernanceForm
                                      action={decideNormativeApplicability}
                                      className="space-y-2 border-t pt-3"
                                    >
                                      <input
                                        type="hidden"
                                        name="sourceId"
                                        value={source.id}
                                      />
                                      <label className="block">
                                        <span className="mb-1 block font-medium">
                                          Decizia explicită
                                        </span>
                                        <select
                                          className="w-full rounded-md border bg-background px-2 py-1.5"
                                          name="decision"
                                          defaultValue="unknown"
                                          required
                                        >
                                          <option
                                            value="applicable"
                                            disabled={
                                              source.officialStatus !== "in_force"
                                            }
                                          >
                                            Aplicabilă — numai dacă statutul este „În vigoare”
                                          </option>
                                          <option value="not_applicable">
                                            Neaplicabilă
                                          </option>
                                          <option value="deferred">
                                            Amânată pentru clarificare
                                          </option>
                                          <option value="unknown">
                                            Aplicabilitate nedeterminată
                                          </option>
                                        </select>
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block font-medium">
                                          Aplicabilă de la (necesar pentru „Aplicabilă”)
                                        </span>
                                        <input
                                          className="w-full rounded-md border bg-background px-2 py-1.5"
                                          type="date"
                                          name="applicableFrom"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block font-medium">
                                          Aplicabilă până la
                                        </span>
                                        <input
                                          className="w-full rounded-md border bg-background px-2 py-1.5"
                                          type="date"
                                          name="applicableUntil"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block font-medium">
                                          Modificare detectată asociată
                                        </span>
                                        <select
                                          className="w-full rounded-md border bg-background px-2 py-1.5"
                                          name="triggeringUpdateId"
                                          defaultValue=""
                                        >
                                          <option value="">
                                            Fără modificare asociată
                                          </option>
                                          {sourceUpdates.map((update) => (
                                            <option
                                              key={update.id}
                                              value={update.id}
                                            >
                                              {update.title}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block font-medium">
                                          Temeiul deciziei
                                        </span>
                                        <textarea
                                          className="w-full rounded-md border bg-background px-2 py-1.5"
                                          name="basisNote"
                                          rows={2}
                                          maxLength={4000}
                                          required
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block font-medium">
                                          Link către dovadă oficială
                                        </span>
                                        <input
                                          className="w-full rounded-md border bg-background px-2 py-1.5"
                                          type="url"
                                          name="evidenceUri"
                                          defaultValue={source.sourceUri ?? ""}
                                        />
                                      </label>
                                      <SubmitButton
                                        size="sm"
                                        pendingLabel="Se înregistrează…"
                                      >
                                        Înregistrează decizia
                                      </SubmitButton>
                                    </GovernanceForm>
                                  </div>
                                </details>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className={verificationClass(
                              source.lastVerificationStatus,
                            )}
                          >
                            {source.lastVerificationStatus === "success"
                              ? "Monitorizare reușită"
                              : source.lastVerificationStatus === "error"
                                ? "Eroare monitorizare"
                                : "Niciodată verificată"}
                          </div>
                          <div className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                            {formatDate(source.lastVerifiedAt)}
                          </div>
                          {source.lastVerificationError ? (
                            <div className="mt-1 max-w-xs text-xs text-status-error-fg">
                              {source.lastVerificationError}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {affected === 0 ? (
                            <span className="text-muted-foreground">Neutilizată</span>
                          ) : (
                            <span className="font-semibold text-heading">
                              {affected} legături
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">
            Modificări detectate
          </h2>
          <p className="text-sm text-muted-foreground">
            Semnale care trebuie analizate înainte de a publica o nouă regulă
            sau ediție în Devizo.
          </p>
        </div>

        {overview.updates.length === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-card">
            Nu există modificări detectate.
          </div>
        ) : (
          <div className="space-y-3">
            {overview.updates.map((update) => (
              <article
                key={update.id}
                className="rounded-xl border bg-card p-4 shadow-card"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-heading">
                        {update.sourceCode}
                      </span>
                      <span
                        className={
                          "rounded-full px-2 py-1 text-[11px] font-medium " +
                          updateStatusClass(update.reviewStatus)
                        }
                      >
                        {update.reviewStatus === "detected"
                          ? "Necesită verificare"
                          : update.reviewStatus === "reviewed"
                            ? "Analizat"
                            : "Închis"}
                      </span>
                    </div>
                    <h3 className="mt-2 font-medium text-heading">
                      {update.title}
                    </h3>
                    {update.summary ? (
                      <p className="mt-1 max-w-3xl text-sm text-secondary-foreground">
                        {update.summary}
                      </p>
                    ) : null}
                    {update.impactSummary ? (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        {update.impactSummary}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Detectat: {formatDate(update.detectedAt)}
                    </p>
                    {update.publicationDate || update.effectiveDate ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Date afișate de sursă — neconfirmate:{" "}
                        {update.publicationDate
                          ? `publicare ${formatDate(update.publicationDate)}`
                          : ""}
                        {update.publicationDate && update.effectiveDate
                          ? " · "
                          : ""}
                        {update.effectiveDate
                          ? `aplicare ${formatDate(update.effectiveDate)}`
                          : ""}
                      </p>
                    ) : null}
                    {update.officialUri ? (
                      <a
                        className="mt-2 inline-block text-xs font-medium text-primary-hover hover:underline"
                        href={update.officialUri}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Deschide sursa oficială ↗
                      </a>
                    ) : null}
                    {(() => {
                      const review = reviewsByUpdate.get(update.id);
                      if (!review) {
                        return update.reviewStatus === "detected" ? null : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Decizie anterioară M8.2; detaliile analizei nu au fost păstrate.
                            {update.reviewedAt
                              ? ` Înregistrată ${formatDate(update.reviewedAt)}.`
                              : ""}
                          </p>
                        );
                      }
                      return (
                        <div className="mt-3 rounded-md bg-muted-section p-3 text-xs">
                          <p className="font-medium">
                            {REVIEW_DECISION_LABELS[review.decision] ??
                              review.decision}
                            {" · "}
                            {formatDate(review.reviewedAt)}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            Analizat de{" "}
                            {review.reviewerName ?? review.reviewerUserId}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            Ediție analizată: {review.sourceCode} ·{" "}
                            {review.sourceEdition}
                            {review.sourceAuthority
                              ? ` · ${review.sourceAuthority}`
                              : ""}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            Fingerprint detectat:{" "}
                            <span className="break-all">
                              {review.detectedFingerprint}
                            </span>
                          </p>
                          {review.previousFingerprint ? (
                            <p className="mt-1 text-muted-foreground">
                              Fingerprint anterior:{" "}
                              <span className="break-all">
                                {review.previousFingerprint}
                              </span>
                            </p>
                          ) : null}
                          {review.officialUri ? (
                            <a
                              className="mt-1 inline-block text-primary-hover hover:underline"
                              href={review.officialUri}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Dovada păstrată la analiză ↗
                            </a>
                          ) : null}
                          {review.note ? (
                            <p className="mt-2 whitespace-pre-wrap">
                              {review.note}
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>

                  {update.reviewStatus === "detected" ? (
                    <GovernanceForm
                      action={reviewNormativeUpdate}
                      className="w-full max-w-sm shrink-0 space-y-2"
                    >
                        <input
                          type="hidden"
                          name="updateId"
                          value={update.id}
                        />
                        <label className="block text-xs font-medium">
                          Rezultatul analizei
                          <select
                            className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                            name="decision"
                            defaultValue="reviewed_no_action"
                            required
                          >
                            {Object.entries(REVIEW_DECISION_LABELS).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="block text-xs font-medium">
                          Notă de analiză (opțional)
                          <textarea
                            className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                            name="note"
                            rows={2}
                            maxLength={4000}
                          />
                        </label>
                        <SubmitButton
                          variant="outline"
                          size="sm"
                          pendingLabel="Se înregistrează…"
                        >
                          Înregistrează analiza
                        </SubmitButton>
                    </GovernanceForm>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">
            Relații între ediții
          </h2>
          <p className="text-sm text-muted-foreground">
            Relația este direcțională: prima sursă este cea care modifică,
            înlocuiește sau completează sursa a doua. Istoricul păstrează ambele
            ediții.
          </p>
        </div>

        {governance.relations.length === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-card">
            Nu există încă relații normative înregistrate.
          </div>
        ) : (
          <div className="space-y-2">
            {governance.relations.map((relation) => (
              <article
                key={relation.id}
                className="rounded-xl border bg-card p-4 text-sm shadow-card"
              >
                <p className="font-medium text-heading">
                  {relation.fromSourceCode} ({relation.fromSourceEdition}){" "}
                  {RELATION_LABELS[relation.relationType] ??
                    relation.relationType}{" "}
                  {relation.toSourceCode} ({relation.toSourceEdition})
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Înregistrată {formatDate(relation.createdAt)}
                  {" de "}
                  {relation.createdByName ?? relation.createdByUserId}
                  {relation.effectiveDate
                    ? ` · dată relevantă ${formatDate(relation.effectiveDate)}`
                    : ""}
                </p>
                {relation.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-secondary-foreground">
                    {relation.note}
                  </p>
                ) : null}
                {relation.evidenceUri ? (
                  <a
                    className="mt-2 inline-block text-xs font-medium text-primary-hover hover:underline"
                    href={relation.evidenceUri}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Deschide dovada ↗
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {overview.sources.length >= 2 ? (
          <details className="rounded-xl border bg-card p-4 shadow-card">
            <summary className="cursor-pointer font-medium text-heading">
              Înregistrează o relație documentată
            </summary>
            <GovernanceForm
              action={relateNormativeSources}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <label className="text-sm font-medium">
                Sursa de la
                <select
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2"
                  name="fromSourceId"
                  required
                >
                  {overview.sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} · {source.edition}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Relația
                <select
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2"
                  name="relationType"
                  defaultValue="related_to"
                  required
                >
                  {Object.entries(RELATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Sursa către
                <select
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2"
                  name="toSourceId"
                  required
                >
                  {overview.sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} · {source.edition}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Dată relevantă (dacă este cunoscută)
                <input
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2"
                  type="date"
                  name="effectiveDate"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Link către dovada oficială
                <input
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2"
                  type="url"
                  name="evidenceUri"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Notă
                <textarea
                  className="mt-1 w-full rounded-md border bg-background px-2 py-2"
                  name="note"
                  rows={2}
                  maxLength={4000}
                />
              </label>
              <div className="sm:col-span-2">
                <SubmitButton pendingLabel="Se înregistrează…">
                  Înregistrează relația
                </SubmitButton>
              </div>
            </GovernanceForm>
          </details>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Pentru a înregistra o relație sunt necesare cel puțin două ediții
            în registru.
          </p>
        )}
      </section>
    </div>
  );
}
